// Log ingestion routes
import { IncomingMessage, ServerResponse } from 'http';
import { parseBody } from '../utils/parseBody';
import { sendSuccess, sendError } from '../utils/response';

// Simple in-memory log store (will be replaced with SmartBuckets later)
const logs: Map<string, Array<{
  id: string;
  projectId: string;
  content: string;
  timestamp: string;
  metadata?: any;
}>> = new Map();

let nextLogId = 1;

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
    const body = await parseBody(req);
    const { projectId, logs: logContent, metadata } = body;

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
    const projectLogs = logs.get(projectId) || [];

    // Store each log entry
    const storedLogs = logEntries.map((entry, index) => {
      const logId = `log_${nextLogId++}`;
      const logEntry = {
        id: logId,
        projectId,
        content: typeof entry === 'string' ? entry : JSON.stringify(entry),
        timestamp,
        metadata: metadata || {},
      };
      projectLogs.push(logEntry);
      return logEntry;
    });

    logs.set(projectId, projectLogs);

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

  const projectLogs = logs.get(projectId) || [];
  
  // Get query params for pagination
  const urlObj = new URL(req.url || '', 'http://localhost');
  const limit = parseInt(urlObj.searchParams.get('limit') || '50');
  const offset = parseInt(urlObj.searchParams.get('offset') || '0');

  const paginatedLogs = projectLogs
    .slice(offset, offset + limit)
    .reverse(); // Most recent first

  sendSuccess(res, {
    logs: paginatedLogs,
    total: projectLogs.length,
    limit,
    offset,
  });
}

// Export helper function to get logs for a project (for use in other modules)
export function getLogsForProject(projectId: string) {
  const projectLogs = logs.get(projectId) || [];
  return projectLogs.map(log => ({
    content: log.content,
    timestamp: log.timestamp,
    metadata: log.metadata,
  }));
}
