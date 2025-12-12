// Log ingestion routes
import { IncomingMessage, ServerResponse } from 'http';
import { parseBody } from '../utils/parseBody';
import { sendSuccess, sendError } from '../utils/response';
import { calculateRiskScoreFromVultr } from '../services/vultrClient';
import { getProjectRiskScore } from '../services/riskLogic';
import { smartBuckets, smartSQL } from '../services/raindropSmart';
import { updateProjectBaseline } from '../services/smartInferenceChains';
import { getUserIdFromAuthHeader } from './auth';

// Fallback in-memory log store (used if SmartBuckets unavailable)
const logs: Map<string, Array<{
  id: string;
  projectId: string;
  content: string;
  timestamp: string;
  metadata?: any;
}>> = new Map();

let nextLogId = 1;

// Helper to store logs (tries SmartBuckets first, falls back to memory)
export async function storeLogs(projectId: string, logEntries: any[], env?: any): Promise<void> {
  // Try SmartBuckets first
  const bucket = 'logs';
  for (const entry of logEntries) {
    const key = `${projectId}/${entry.timestamp}/${entry.id}`;
    const stored = await smartBuckets.put(bucket, key, entry, env);
    
    if (!stored) {
      // Fallback to in-memory storage
      const projectLogs = logs.get(projectId) || [];
      projectLogs.push(entry);
      logs.set(projectId, projectLogs);
    }
  }
}

// Helper to retrieve logs (tries SmartBuckets first, falls back to memory)
// For risk scoring, we limit to last 1000 logs for performance (still accurate for scoring)
export async function getLogs(projectId: string, env?: any, limit?: number): Promise<any[]> {
  // Try SmartBuckets first
  const bucket = 'logs';
  const prefix = `${projectId}/`;
  
  // For risk scoring, limit to last 1000 logs for performance (still accurate)
  // For other uses, use provided limit or default to 1000
  const maxLogsForScoring = limit || 1000;
  const keys = await smartBuckets.list(bucket, prefix, env, maxLogsForScoring);
  
  if (keys.length > 0) {
    // Retrieve from SmartBuckets - get most recent logs
    const logEntries: any[] = [];
    const keysToFetch = keys.slice(-maxLogsForScoring); // Get most recent logs
    console.log(`[getLogs] Fetching ${keysToFetch.length} log entries from SmartBuckets...`);
    
    // Batch fetch with progress logging for large sets
    const batchSize = 50;
    for (let i = 0; i < keysToFetch.length; i += batchSize) {
      const batch = keysToFetch.slice(i, i + batchSize);
      const batchPromises = batch.map(key => smartBuckets.get(bucket, key, env));
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(entry => {
        if (entry) {
          logEntries.push(entry);
        }
      });
      if (i % 200 === 0 && i > 0) {
        console.log(`[getLogs] Progress: ${i}/${keysToFetch.length} logs fetched...`);
      }
    }
    
    console.log(`[getLogs] Retrieved ${logEntries.length} logs from SmartBuckets (from ${keys.length} total keys)`);
    return logEntries.sort((a: any, b: any) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }
  
  // Fallback to in-memory storage
  const memoryLogs = logs.get(projectId) || [];
  console.log(`[getLogs] Using in-memory fallback, found ${memoryLogs.length} logs`);
  return memoryLogs;
}

async function requireAuth(req: IncomingMessage, res: ServerResponse): Promise<string | null> {
  const userId = await getUserIdFromAuthHeader(req.headers.authorization);
  if (!userId) {
    sendError(res, 401, 'Unauthorized');
    return null;
  }
  return userId;
}

export async function handleIngestLogs(req: IncomingMessage, res: ServerResponse) {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  try {
    // Extract projectId from URL if present (e.g., /api/ingest/:projectId)
    const url = req.url || '';
    const parts = url.split('/').filter(p => p);
    let projectId: string | undefined;
    
    const ingestIndex = parts.indexOf('ingest');
    if (ingestIndex >= 0 && parts.length > ingestIndex + 1) {
      projectId = parts[ingestIndex + 1];
    }
    
    // Parse body
    const body = await parseBody(req);
    const { projectId: bodyProjectId, logs: logContent, metadata } = body;
    
    // Use projectId from URL if available, otherwise from body
    projectId = projectId || bodyProjectId;

    if (!projectId) {
      sendError(res, 400, 'Project ID is required');
      return;
    }

    if (!logContent || (typeof logContent !== 'string' && !Array.isArray(logContent))) {
      sendError(res, 400, 'Logs content is required (string or array)');
      return;
    }

    // Normalize logs to array format
    let logEntries: string[];
    if (Array.isArray(logContent)) {
      logEntries = logContent;
    } else {
      // Try splitting by newlines first
      logEntries = logContent.split('\n').filter(line => line.trim());
      
      // If we only got 1 entry, try splitting by timestamp pattern (YYYY-MM-DD HH:MM:SS)
      if (logEntries.length === 1 && logEntries[0].length > 100) {
        const timestampPattern = /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/g;
        const matches = logEntries[0].match(timestampPattern);
        
        if (matches && matches.length > 1) {
          // Split by timestamp pattern
          const parts = logEntries[0].split(timestampPattern).filter(p => p.trim());
          logEntries = [];
          for (let i = 0; i < parts.length; i += 2) {
            if (parts[i] && parts[i + 1]) {
              logEntries.push(parts[i] + parts[i + 1]);
            }
          }
          console.log(`[Ingest] Split concatenated logs into ${logEntries.length} entries`);
        }
      }
    }

    const timestamp = new Date().toISOString();

    // Store each log entry
    const storedLogs = logEntries.map((entry, index) => {
      const logId = `log_${Date.now()}_${index}`;
      return {
        id: logId,
        projectId,
        content: typeof entry === 'string' ? entry : JSON.stringify(entry),
        timestamp,
        metadata: metadata || {},
      };
    });

    // Store logs (tries SmartBuckets, falls back to memory)
    await storeLogs(projectId, storedLogs);
    console.log(`[Ingest] ✅ Stored ${storedLogs.length} logs successfully`);

    // Get all logs for risk scoring
    console.log('[Ingest] 🔍 Getting all logs for risk scoring...');
    let projectLogs = await getLogs(projectId);
    console.log(`[Ingest] 📊 Retrieved ${projectLogs.length} logs from storage`);

    // Fallback: If DB retrieval is empty (eventual consistency) but we just ingested logs,
    // use the ingested logs for scoring to ensure we don't return a 0 score.
    if (projectLogs.length === 0 && storedLogs.length > 0) {
      console.warn(`[Ingest] ⚠️ getLogs returned 0 logs after ingesting ${storedLogs.length}. Using ingested logs for scoring.`);
      projectLogs = storedLogs;
    }

    console.log('[Ingest] 🎯 Starting risk score calculation...');
    // Calculate and store risk score after ingestion
    try {
      console.log('[Ingest] 📝 Preparing logs for scoring...');
      const projectLogsForScoring = projectLogs.map(log => ({
        content: log.content,
        timestamp: log.timestamp,
        metadata: log.metadata,
      }));
      console.log(`[Ingest] ✅ Prepared ${projectLogsForScoring.length} logs for scoring`);

      let riskScore;
      console.log(`[Ingest] 🧮 Calculating risk score for ${projectLogsForScoring.length} logs`);
      try {
        console.log('[Ingest] Trying Vultr worker...');
        riskScore = await calculateRiskScoreFromVultr({
          projectId,
          logs: projectLogsForScoring,
        });
        console.log('[Ingest] Vultr worker returned:', riskScore);
      } catch (error) {
        console.warn('[Ingest] Vultr worker unavailable, using local calculation:', error);
        riskScore = getProjectRiskScore(projectLogsForScoring);
        console.log('[Ingest] Local calculation returned:', riskScore);
      }

      // Store risk score in history
      await storeRiskScore(projectId, riskScore);
      
      // Update project baseline in SmartMemory for better forecasts
      await updateProjectBaseline(projectId, riskScore.score);
      
      // Include risk score in response
      sendSuccess(res, {
        message: `Ingested ${storedLogs.length} log entries`,
        count: storedLogs.length,
        projectId,
        timestamp,
        riskScore,
      }, 201);
      return;
    } catch (error) {
      console.error('[Ingest] ❌ Error calculating risk score:', error);
      console.error('[Ingest] ❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('[Ingest] ❌ Error message:', error instanceof Error ? error.message : String(error));
      // Don't fail the ingestion if risk calculation fails
    }

    console.log('[Ingest] ⚠️ Returning response WITHOUT risk score (fallback path)');
    sendSuccess(res, {
      message: `Ingested ${storedLogs.length} log entries`,
      count: storedLogs.length,
      projectId,
      timestamp,
    }, 201);
  } catch (error) {
    console.error('Ingest error:', error);
    sendError(res, 500, 'Internal server error');
  }
}

export async function handleGetLogs(req: IncomingMessage, res: ServerResponse) {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const url = req.url || '';
  const parts = url.split('/').filter(p => p);
  const projectIdIndex = parts.indexOf('ingest') + 1;
  const projectId = parts[projectIdIndex];

  if (!projectId) {
    sendError(res, 400, 'Project ID is required');
    return;
  }

  // Get logs (tries SmartBuckets, falls back to memory)
  const projectLogs = await getLogs(projectId);
  
  // Get query params for pagination
  const urlObj = new URL(req.url || '', 'http://localhost');
  const limit = parseInt(urlObj.searchParams.get('limit') || '50');
  const offset = parseInt(urlObj.searchParams.get('offset') || '0');

  const paginatedLogs = projectLogs
    .slice(offset, offset + limit);

  sendSuccess(res, {
    logs: paginatedLogs,
    total: projectLogs.length,
    limit,
    offset,
  });
}

// Export helper function to get logs for a project (for use in other modules)
export async function getLogsForProject(projectId: string, env?: any) {
  const projectLogs = await getLogs(projectId, env);
  return projectLogs.map(log => ({
    content: log.content,
    timestamp: log.timestamp,
    metadata: log.metadata,
  }));
}

// Risk history storage (tries SmartSQL, falls back to memory)
const riskHistory: Map<string, Array<{
  projectId: string;
  score: number;
  labels: string[];
  timestamp: string;
  factors: any;
}>> = new Map();

export async function storeRiskScore(projectId: string, riskScore: any, env?: any) {
  let stored = false;
  const ts = riskScore.timestamp || new Date().toISOString();
  try {
    await smartSQL.execute(
      'INSERT INTO risk_history (id, project_id, score, labels, factors, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [
        `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        projectId,
        riskScore.score,
        JSON.stringify(riskScore.labels),
        JSON.stringify(riskScore.factors || {}),
        ts,
      ],
      env
    );
    stored = true;
  } catch (error) {
    console.warn('SmartSQL insert failed, continuing to bucket fallback:', error);
  }

  // Persist to SmartBuckets for durability/fallback
  try {
    await smartBuckets.put(
      'risk-history',
      `${projectId}/${ts}`,
      {
        projectId,
        score: riskScore.score,
        labels: riskScore.labels,
        timestamp: ts,
        factors: riskScore.factors,
      },
      env
    );
    stored = true;
  } catch (err) {
    console.warn('SmartBuckets risk-history write failed:', err);
  }
  
  // Fallback to in-memory storage if nothing was persisted
  if (!stored) {
    const history = riskHistory.get(projectId) || [];
    history.push({
      projectId,
      score: riskScore.score,
      labels: riskScore.labels,
      timestamp: ts,
      factors: riskScore.factors,
    });
    if (history.length > 100) {
      history.shift();
    }
    riskHistory.set(projectId, history);
  }
}

export async function getRiskHistory(projectId: string, limit = 50, env?: any) {
  try {
    const rows = await smartSQL.query(
      'SELECT score, labels, factors, timestamp FROM risk_history WHERE project_id = ? ORDER BY timestamp DESC LIMIT ?',
      [projectId, limit],
      env
    );
    
    console.log(`[getRiskHistory] Found ${rows.length} entries for project ${projectId}`);
    
    if (rows.length > 0) {
      const mapped = rows.map(row => ({
        score: row.score,
        labels: typeof row.labels === 'string' ? JSON.parse(row.labels) : row.labels,
        factors: typeof row.factors === 'string' ? JSON.parse(row.factors) : row.factors,
        timestamp: row.timestamp,
      }));
      console.log('[getRiskHistory] Latest entry:', mapped[0]);
      return mapped;
    }
  } catch (error) {
    console.warn('[getRiskHistory] SmartSQL query failed, trying bucket fallback:', error);
  }
  
  // SmartBuckets fallback
  try {
    const keys = await smartBuckets.list('risk-history', `${projectId}/`, env);
    if (keys.length > 0) {
      const entries = [];
      const recentKeys = keys.sort().slice(-limit).reverse();
      for (const key of recentKeys) {
        const entry = await smartBuckets.get('risk-history', key, env);
        if (entry) entries.push(entry);
      }
      if (entries.length > 0) {
        console.log(`[getRiskHistory] Using SmartBuckets fallback, found ${entries.length} entries`);
        return entries;
      }
    }
  } catch (err) {
    console.warn('[getRiskHistory] SmartBuckets fallback failed:', err);
  }
  
  // Fallback to in-memory storage
  const history = riskHistory.get(projectId) || [];
  console.log(`[getRiskHistory] Using fallback, found ${history.length} entries`);
  return history.slice(-limit).reverse(); // Most recent first
}
