// Project management routes
import { IncomingMessage, ServerResponse } from 'http';
import { parseBody } from '../utils/parseBody';
import { sendSuccess, sendError } from '../utils/response';
import { getProjectRiskScore } from '../services/riskLogic';
import { calculateRiskScoreFromVultr } from '../services/vultrClient';
import { smartSQL } from '../services/raindropSmart';
import { getUserIdFromAuthHeader } from './auth';

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
    console.log(`[Projects] Found ${rows.length} projects for user in SmartSQL:`, userId);
    // Normalize field names from snake_case to camelCase
    return rows.map(row => ({
      id: row.id,
      userId: row.user_id || row.userId,
      name: row.name,
      description: row.description,
      createdAt: row.created_at || row.createdAt,
      updatedAt: row.updated_at || row.updatedAt,
    }));
  } catch (error) {
    console.warn('[Projects] SmartSQL query failed, using fallback:', error);
    // Fallback to in-memory storage
    const fallbackProjects = Array.from(projects.values())
      .filter(p => p.userId === userId);
    console.log(`[Projects] Found ${fallbackProjects.length} projects for user in fallback:`, userId);
    return fallbackProjects;
  }
}

// Helper to get project by ID (tries SmartSQL first, falls back to memory)
async function getProjectFromDB(projectId: string): Promise<any | null> {
  try {
    const rows = await smartSQL.query(
      'SELECT * FROM projects WHERE id = ?',
      [projectId]
    );
    if (rows.length > 0) {
      const row = rows[0];
      console.log('[Projects] Project found in SmartSQL:', projectId);
      // Normalize field names from snake_case to camelCase
      return {
        id: row.id,
        userId: row.user_id || row.userId,
        name: row.name,
        description: row.description,
        createdAt: row.created_at || row.createdAt,
        updatedAt: row.updated_at || row.updatedAt,
      };
    }
    console.log('[Projects] Project not found in SmartSQL:', projectId);
    return null;
  } catch (error) {
    console.warn('[Projects] SmartSQL query failed, using fallback:', error);
    // Fallback to in-memory storage
    const project = projects.get(projectId) || null;
    if (project) {
      console.log('[Projects] Project found in fallback:', projectId);
    }
    return project;
  }
}

// Helper to create project (tries SmartSQL first, falls back to memory)
async function createProjectInDB(project: any): Promise<void> {
  try {
    const result = await smartSQL.execute(
      'INSERT INTO projects (id, user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [project.id, project.userId, project.name, project.description || '', project.createdAt, project.updatedAt]
    );
    // Check if insert actually succeeded
    if (result && result.affectedRows > 0) {
      console.log('[Projects] Project created in SmartSQL:', project.id);
      return; // Success, don't use fallback
    }
    // If affectedRows is 0, something went wrong
    console.warn('[Projects] SmartSQL insert returned 0 affected rows, using fallback');
    throw new Error('Insert failed - 0 rows affected');
  } catch (error) {
    console.warn('[Projects] SmartSQL insert failed, using fallback:', error);
    // Fallback to in-memory storage
    projects.set(project.id, project);
    console.log('[Projects] Project created in fallback storage:', project.id);
  }
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

async function requireAuth(req: IncomingMessage, res: ServerResponse): Promise<string | null> {
  const userId = await getUserIdFromAuthHeader(req.headers.authorization);
  if (!userId) {
    sendError(res, 401, 'Unauthorized');
    return null;
  }
  return userId;
}

export async function handleGetProjects(req: IncomingMessage, res: ServerResponse) {
  const userId = await requireAuth(req, res);
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
  const userId = await requireAuth(req, res);
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

  // Handle both camelCase and snake_case from database
  const projectUserId = project.userId || project.user_id;
  if (projectUserId !== userId) {
    sendError(res, 403, 'Forbidden');
    return;
  }

  // Get the latest risk score from history
  const { getRiskHistory } = await import('../routes/ingest');
  const riskHistory = await getRiskHistory(projectId, 1);
  console.log(`[handleGetProject] Risk history entries: ${riskHistory.length}`);
  const riskScore = riskHistory.length > 0 ? {
    score: riskHistory[0].score,
    labels: riskHistory[0].labels,
    timestamp: riskHistory[0].timestamp,
    factors: riskHistory[0].factors || {},
  } : null;
  console.log('[handleGetProject] Returning risk score:', riskScore);

  sendSuccess(res, { 
    project,
    riskScore,
  });
}

export async function handleCreateProject(req: IncomingMessage, res: ServerResponse) {
  const userId = await requireAuth(req, res);
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
  const userId = await requireAuth(req, res);
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

  // Handle both camelCase and snake_case from database
  const projectUserId = project.userId || project.user_id;
  if (projectUserId !== userId) {
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
  const userId = await requireAuth(req, res);
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

  // Handle both camelCase and snake_case from database
  const projectUserId = project.userId || project.user_id;
  if (projectUserId !== userId) {
    sendError(res, 403, 'Forbidden');
    return;
  }

  await deleteProjectFromDB(projectId);
  sendSuccess(res, { message: 'Project deleted successfully' });
}
