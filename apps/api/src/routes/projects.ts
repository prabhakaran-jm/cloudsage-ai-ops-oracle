// Project management routes
import { IncomingMessage, ServerResponse } from 'http';
import { parseBody } from '../utils/parseBody';
import { sendSuccess, sendError } from '../utils/response';
import { getProjectRiskScore } from '../services/riskLogic';
import { calculateRiskScoreFromVultr } from '../services/vultrClient';

// Simple in-memory project store (will be replaced with SmartSQL later)
const projects: Map<string, {
  id: string;
  userId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}> = new Map();

let nextProjectId = 1;

// Extract user ID from token (simplified for MVP)
function getUserIdFromToken(req: IncomingMessage): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  // For MVP, we'll use a simple format: userId is in the token
  // In production, decode JWT properly
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

export async function handleGetProjects(req: IncomingMessage, res: ServerResponse) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const userProjects = Array.from(projects.values())
    .filter(p => p.userId === userId)
    .map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

  sendSuccess(res, { projects: userProjects });
}

export async function handleGetProject(req: IncomingMessage, res: ServerResponse) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const url = req.url || '';
  // Extract project ID from URL like /api/projects/project_1
  const parts = url.split('/').filter(p => p);
  const projectIdIndex = parts.indexOf('projects') + 1;
  const projectId = parts[projectIdIndex];

  if (!projectId) {
    sendError(res, 400, 'Project ID is required');
    return;
  }

  const project = projects.get(projectId);
  if (!project) {
    sendError(res, 404, 'Project not found');
    return;
  }

  if (project.userId !== userId) {
    sendError(res, 403, 'Forbidden');
    return;
  }

  // Get project logs and calculate risk score
  const { getLogsForProject } = await import('../routes/ingest');
  const projectLogs = getLogsForProject(projectId);
  
  // Try Vultr worker first, fallback to local calculation
  let riskScore;
  try {
    riskScore = await calculateRiskScoreFromVultr({
      projectId,
      logs: projectLogs,
    });
  } catch (error) {
    console.warn('Vultr worker unavailable, using local calculation:', error);
    // Fallback to local risk scoring
    riskScore = getProjectRiskScore(projectLogs);
  }

  sendSuccess(res, { 
    project,
    riskScore,
  });
}

export async function handleCreateProject(req: IncomingMessage, res: ServerResponse) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const body = await parseBody(req);
    const { name, description } = body;

    if (!name) {
      sendError(res, 400, 'Project name is required');
      return;
    }

    const projectId = `project_${nextProjectId++}`;
    const now = new Date().toISOString();

    const project = {
      id: projectId,
      userId,
      name,
      description: description || '',
      createdAt: now,
      updatedAt: now,
    };

    projects.set(projectId, project);

    sendSuccess(res, { project }, 201);
  } catch (error) {
    sendError(res, 500, 'Internal server error');
  }
}

export async function handleUpdateProject(req: IncomingMessage, res: ServerResponse) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const url = req.url || '';
  const parts = url.split('/').filter(p => p);
  const projectIdIndex = parts.indexOf('projects') + 1;
  const projectId = parts[projectIdIndex];

  if (!projectId) {
    sendError(res, 400, 'Project ID is required');
    return;
  }

  const project = projects.get(projectId);
  if (!project) {
    sendError(res, 404, 'Project not found');
    return;
  }

  if (project.userId !== userId) {
    sendError(res, 403, 'Forbidden');
    return;
  }

  try {
    const body = await parseBody(req);
    const { name, description } = body;

    project.name = name || project.name;
    project.description = description !== undefined ? description : project.description;
    project.updatedAt = new Date().toISOString();

    projects.set(projectId, project);

    sendSuccess(res, { project });
  } catch (error) {
    sendError(res, 500, 'Internal server error');
  }
}

export async function handleDeleteProject(req: IncomingMessage, res: ServerResponse) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const url = req.url || '';
  const parts = url.split('/').filter(p => p);
  const projectIdIndex = parts.indexOf('projects') + 1;
  const projectId = parts[projectIdIndex];

  if (!projectId) {
    sendError(res, 400, 'Project ID is required');
    return;
  }

  const project = projects.get(projectId);
  if (!project) {
    sendError(res, 404, 'Project not found');
    return;
  }

  if (project.userId !== userId) {
    sendError(res, 403, 'Forbidden');
    return;
  }

  projects.delete(projectId);
  sendSuccess(res, { message: 'Project deleted successfully' });
}
