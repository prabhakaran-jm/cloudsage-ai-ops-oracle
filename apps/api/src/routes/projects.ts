// Project management routes
import { IncomingMessage, ServerResponse } from 'http';
import { parseBody } from '../utils/parseBody';
import { sendSuccess, sendError } from '../utils/response';
import { getProjectRiskScore } from '../services/riskLogic';
import { calculateRiskScoreFromVultr } from '../services/vultrClient';
import { smartSQL } from '../services/raindropSmart';

// Fallback in-memory project store (used if SmartSQL unavailable)
const projects: Map<string, {
  id: string;
  userId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}> = new Map();

let nextProjectId = 1;

// Helper to get projects (tries SmartSQL first, falls back to memory)
async function getProjectsFromDB(userId: string): Promise<any[]> {
  try {
    const rows = await smartSQL.query(
      'SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    if (rows.length > 0) {
      return rows;
    }
  } catch (error) {
    console.warn('SmartSQL query failed, using fallback:', error);
  }
  
  // Fallback to in-memory storage
  return Array.from(projects.values())
    .filter(p => p.userId === userId);
}

// Helper to get project by ID (tries SmartSQL first, falls back to memory)
async function getProjectFromDB(projectId: string): Promise<any | null> {
  try {
    const rows = await smartSQL.query(
      'SELECT * FROM projects WHERE id = ?',
      [projectId]
    );
    if (rows.length > 0) {
      return rows[0];
    }
  } catch (error) {
    console.warn('SmartSQL query failed, using fallback:', error);
  }
  
  // Fallback to in-memory storage
  return projects.get(projectId) || null;
}

// Helper to create project (tries SmartSQL first, falls back to memory)
async function createProjectInDB(project: any): Promise<void> {
  try {
    await smartSQL.execute(
      'INSERT INTO projects (id, user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [project.id, project.userId, project.name, project.description || '', project.createdAt, project.updatedAt]
    );
    return; // Success, don't use fallback
  } catch (error) {
    console.warn('SmartSQL insert failed, using fallback:', error);
  }
  
  // Fallback to in-memory storage
  projects.set(project.id, project);
}

// Helper to update project (tries SmartSQL first, falls back to memory)
async function updateProjectInDB(projectId: string, updates: any): Promise<void> {
  try {
    await smartSQL.execute(
      'UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?',
      [updates.name, updates.description || '', updates.updatedAt, projectId]
    );
    return; // Success, don't use fallback
  } catch (error) {
    console.warn('SmartSQL update failed, using fallback:', error);
  }
  
  // Fallback to in-memory storage
  const project = projects.get(projectId);
  if (project) {
    Object.assign(project, updates);
    projects.set(projectId, project);
  }
}

// Helper to delete project (tries SmartSQL first, falls back to memory)
async function deleteProjectFromDB(projectId: string): Promise<void> {
  try {
    await smartSQL.execute('DELETE FROM projects WHERE id = ?', [projectId]);
    return; // Success, don't use fallback
  } catch (error) {
    console.warn('SmartSQL delete failed, using fallback:', error);
  }
  
  // Fallback to in-memory storage
  projects.delete(projectId);
}

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

  const userProjects = await getProjectsFromDB(userId);
  const formattedProjects = userProjects.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));

  sendSuccess(res, { projects: formattedProjects });
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

  const project = await getProjectFromDB(projectId);
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
  const projectLogs = await getLogsForProject(projectId);
  
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

    const projectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const project = {
      id: projectId,
      userId,
      name,
      description: description || '',
      createdAt: now,
      updatedAt: now,
    };

    await createProjectInDB(project);

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

  const project = await getProjectFromDB(projectId);
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

    const updates = {
      name: name || project.name,
      description: description !== undefined ? description : project.description,
      updatedAt: new Date().toISOString(),
    };

    await updateProjectInDB(projectId, updates);
    
    // Get updated project
    const updatedProject = await getProjectFromDB(projectId);

    sendSuccess(res, { project: updatedProject });
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

  const project = await getProjectFromDB(projectId);
  if (!project) {
    sendError(res, 404, 'Project not found');
    return;
  }

  if (project.userId !== userId) {
    sendError(res, 403, 'Forbidden');
    return;
  }

  await deleteProjectFromDB(projectId);
  sendSuccess(res, { message: 'Project deleted successfully' });
}
