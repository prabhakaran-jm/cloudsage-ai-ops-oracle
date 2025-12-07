// Log ingestion routes
import { IncomingMessage, ServerResponse } from 'http';
import { parseBody } from '../utils/parseBody';
import { sendSuccess, sendError } from '../utils/response';
import { calculateRiskScoreFromVultr } from '../services/vultrClient';
import { getProjectRiskScore } from '../services/riskLogic';
import { smartBuckets, smartSQL } from '../services/raindropSmart';

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
async function storeLogs(projectId: string, logEntries: any[]): Promise<void> {
  // Try SmartBuckets first
  const bucket = 'logs';
  for (const entry of logEntries) {
    const key = `${projectId}/${entry.timestamp}/${entry.id}`;
    const stored = await smartBuckets.put(bucket, key, entry);
    
    if (!stored) {
      // Fallback to in-memory storage
      const projectLogs = logs.get(projectId) || [];
      projectLogs.push(entry);
      logs.set(projectId, projectLogs);
    }
  }
}

// Helper to retrieve logs (tries SmartBuckets first, falls back to memory)
export async function getLogs(projectId: string): Promise<any[]> {
  // Try SmartBuckets first
  const bucket = 'logs';
  const prefix = `${projectId}/`;
  const keys = await smartBuckets.list(bucket, prefix);
  
  if (keys.length > 0) {
    // Retrieve from SmartBuckets
    const logEntries = [];
    for (const key of keys.slice(-100)) { // Last 100 logs
      const entry = await smartBuckets.get(bucket, key);
      if (entry) {
        logEntries.push(entry);
      }
    }
    return logEntries.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }
  
  // Fallback to in-memory storage
  return logs.get(projectId) || [];
}

// Extract user ID from token
function getUserIdFromToken(req: IncomingMessage): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  try {
    const token = authHeader.substring(7);
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const userId = decoded.split(':')[0];
    return userId || null;
  } catch {
    return null;
  }
}

function requireAuth(req: IncomingMessage, res: ServerResponse): string | null {
  const userId = getUserIdFromToken(req);
  if (!userId) {
    sendError(res, 401, 'Unauthorized');
    return null;
  }
  return userId;
}

export async function handleIngestLogs(req: IncomingMessage, res: ServerResponse) {
  const userId = requireAuth(req, res);
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
    const logEntries = Array.isArray(logContent) 
      ? logContent 
      : logContent.split('\n').filter(line => line.trim());

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

    // Get all logs for risk scoring
    const projectLogs = await getLogs(projectId);

    // Calculate and store risk score after ingestion
    try {
      const projectLogsForScoring = projectLogs.map(log => ({
        content: log.content,
        timestamp: log.timestamp,
        metadata: log.metadata,
      }));

      let riskScore;
      try {
        riskScore = await calculateRiskScoreFromVultr({
          projectId,
          logs: projectLogsForScoring,
        });
      } catch (error) {
        console.warn('Vultr worker unavailable, using local calculation:', error);
        riskScore = getProjectRiskScore(projectLogsForScoring);
      }

      // Store risk score in history (will be replaced with SmartSQL)
      storeRiskScore(projectId, riskScore);
      
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
      console.error('Error calculating risk score:', error);
      // Don't fail the ingestion if risk calculation fails
    }

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
  const userId = requireAuth(req, res);
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
export async function getLogsForProject(projectId: string) {
  const projectLogs = await getLogs(projectId);
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

export async function storeRiskScore(projectId: string, riskScore: any) {
  try {
    // Try SmartSQL first
    await smartSQL.execute(
      'INSERT INTO risk_history (id, project_id, score, labels, factors, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [
        `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        projectId,
        riskScore.score,
        JSON.stringify(riskScore.labels),
        JSON.stringify(riskScore.factors || {}),
        riskScore.timestamp,
      ]
    );
    return; // Success, don't use fallback
  } catch (error) {
    console.warn('SmartSQL insert failed, using fallback:', error);
  }
  
  // Fallback to in-memory storage
  const history = riskHistory.get(projectId) || [];
  history.push({
    projectId,
    score: riskScore.score,
    labels: riskScore.labels,
    timestamp: riskScore.timestamp,
    factors: riskScore.factors,
  });
  // Keep only last 100 entries per project
  if (history.length > 100) {
    history.shift();
  }
  riskHistory.set(projectId, history);
}

export async function getRiskHistory(projectId: string, limit = 50) {
  try {
    // Try SmartSQL first
    const rows = await smartSQL.query(
      'SELECT score, labels, timestamp FROM risk_history WHERE project_id = ? ORDER BY timestamp DESC LIMIT ?',
      [projectId, limit]
    );
    
    if (rows.length > 0) {
      return rows.map(row => ({
        score: row.score,
        labels: typeof row.labels === 'string' ? JSON.parse(row.labels) : row.labels,
        timestamp: row.timestamp,
      }));
    }
  } catch (error) {
    console.warn('SmartSQL query failed, using fallback:', error);
  }
  
  // Fallback to in-memory storage
  const history = riskHistory.get(projectId) || [];
  return history.slice(-limit).reverse(); // Most recent first
}
