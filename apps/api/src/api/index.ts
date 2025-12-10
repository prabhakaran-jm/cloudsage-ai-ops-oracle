import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono, Context } from 'hono';
import { Env } from './raindrop.gen';
import { corsAllowAll } from '@liquidmetal-ai/raindrop-framework/core/cors';
import { smartBuckets } from '../services/raindropSmart';

// Import business logic from route files
import * as authRoutes from '../routes/auth';
import * as projectRoutes from '../routes/projects';
import * as ingestRoutes from '../routes/ingest';
import * as forecastRoutes from '../routes/forecast';

// Web API types
type Headers = globalThis.Headers;
type Blob = globalThis.Blob;
type FormData = globalThis.FormData;
type ReadableStream = globalThis.ReadableStream;

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// CORS middleware - handled by Raindrop framework via _app/cors.ts
// No need to add here as it's application-wide

// Debug middleware to check env availability
app.use('*', async (c: Context<{ Bindings: Env }>, next: () => Promise<void>) => {
  console.log('[CloudSage] Request:', c.req.method, c.req.url);
  console.log('[CloudSage] c.env exists:', !!c.env);
  // SmartSQL disabled - MAIN_DB not available
  await next();
});

// Request logging middleware
app.use('*', async (c: Context<{ Bindings: Env }>, next: () => Promise<void>) => {
  const start = Date.now();
  const url = c.req.url;
  const method = c.req.method;

  await next();

  const duration = Date.now() - start;
  // Safely log if logger exists
  if (c.env && c.env.logger) {
    c.env.logger.info(`${method} ${url}`, {
      status: c.res.status,
      duration: `${duration}ms`
    });
  } else {
    // Fallback to console logging
    console.log(`${method} ${url} - ${c.res.status} (${duration}ms)`);
  }
});

// Helper to extract user ID from token
function getUserIdFromToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  try {
    const token = authHeader.substring(7);
    const decoded = atob(token); // Use atob instead of Buffer in browser/worker context
    const userId = decoded.split(':')[0];
    return userId || null;
  } catch {
    return null;
  }
}

// Helper to require auth
function requireAuth(c: Context<{ Bindings: Env }>): string | null {
  const authHeader = c.req.header('authorization');
  const userId = getUserIdFromToken(authHeader);
  if (!userId) {
    c.json({ error: 'Unauthorized' }, 401);
    return null;
  }
  return userId;
}

// Health check
app.get('/health', (c: Context<{ Bindings: Env }>) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/hello', (c: Context<{ Bindings: Env }>) => {
  return c.json({ 
    status: 'ok',
    message: 'Hello from CloudSage API!'
  });
});

// === Auth Routes ===
app.post('/api/auth/register', async (c: Context<{ Bindings: Env }>) => {
  try {
    const body = await c.req.json();
    let { email, password } = body;

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    // Normalize email
    email = email.toLowerCase().trim();

    console.log('[Auth] Registration attempt for email:', email);

    // Check SmartBuckets first
    const existingUser = await smartBuckets.get('users', email, c.env);
    if (existingUser) {
      console.log('[Auth] User already exists (Bucket):', email);
      return c.json({ error: 'User already exists' }, 400);
    }

    // SmartSQL disabled - using SmartBuckets only
    // Removed MAIN_DB checks to avoid foreign key constraint errors

    // Create user
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const hashedPassword = btoa(password);
    const now = new Date().toISOString();

    const userData = {
      id: userId,
      email,
      password_hash: hashedPassword,
      created_at: now,
      updated_at: now
    };

    // Store in SmartBuckets (Primary)
    await smartBuckets.put('users', email, userData, c.env);
    console.log('[Auth] User created in SmartBuckets:', email);

    const token = btoa(`${userId}:${Date.now()}`);

    return c.json({
      token,
      user: { id: userId, email },
    });
  } catch (error: any) {
    console.error('[Auth] Registration error:', error?.message || error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.post('/api/auth/login', async (c: Context<{ Bindings: Env }>) => {
  try {
    const body = await c.req.json();
    let { email, password } = body;

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    // Normalize email
    email = email.toLowerCase().trim();

    console.log('[Auth] Login attempt for email:', email);

    // Try SmartBuckets (Primary storage)
    let user = await smartBuckets.get('users', email, c.env);

    if (!user) {
      console.log('[Auth] User not found:', email);
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    console.log('[Auth] User found:', JSON.stringify({ ...user, password_hash: '[REDACTED]' }));
    console.log('[Auth] User object keys:', Object.keys(user));
    
    // Handle different data formats from SmartBuckets
    const actualUser = user.value || user.data || user;
    const userPassword = actualUser.password_hash || actualUser.password || user.password_hash || user.password;
    const hashedPassword = btoa(password);
    
    console.log('[Auth] Comparing passwords - stored length:', userPassword?.length, 'provided hash length:', hashedPassword.length);
    
    if (!userPassword || userPassword !== hashedPassword) {
      console.log('[Auth] Password mismatch for:', email);
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    
    // Use actualUser for id and email
    const userIdForToken = actualUser.id || user.id;
    const userEmailForResponse = actualUser.email || user.email;

    const token = btoa(`${userIdForToken}:${Date.now()}`);

    console.log('[Auth] Login successful for:', email);
    return c.json({
      token,
      user: { id: userIdForToken, email: userEmailForResponse },
    });
  } catch (error: any) {
    console.error('[Auth] Login error:', error?.message || error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.post('/api/auth/logout', (c: Context<{ Bindings: Env }>) => {
  return c.json({ message: 'Logged out successfully' });
});

// === Project Routes ===
app.get('/api/projects', async (c: Context<{ Bindings: Env }>) => {
  const userId = requireAuth(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  try {
    let projects: any[] = [];
    
    // Try SmartBuckets first
    try {
      console.log(`[Projects] Listing projects for prefix: ${userId}/`);
      const keys = await smartBuckets.list('projects', `${userId}/`, c.env);
      console.log(`[Projects] Bucket list returned ${keys?.length || 0} keys:`, keys);
      
      if (keys && keys.length > 0) {
        for (const key of keys) {
          const p = await smartBuckets.get('projects', key, c.env);
          // Filter out metadata objects (shouldn't happen if .text()/.json() worked, but be safe)
          if (p && (p.id || p.name)) {
            projects.push(p);
          } else if (p) {
            console.warn(`[Projects] Skipping metadata object for key: ${key}, keys:`, Object.keys(p));
          }
        }
        // Sort by created_at DESC
        projects.sort((a, b) => 
          new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime()
        );
        console.log(`[Projects] Found ${projects.length} projects in Buckets for user:`, userId);
      }
    } catch (e) {
      console.warn('[Projects] Bucket list failed:', e);
    }

    // SmartSQL disabled - using SmartBuckets only

    return c.json({ projects: projects.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      createdAt: p.created_at || p.createdAt,
      updatedAt: p.updated_at || p.updatedAt,
    })) });
  } catch (error: any) {
    console.error('[Projects] Get projects error:', error?.message || error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.get('/api/projects/:projectId', async (c: Context<{ Bindings: Env }>) => {
  const userId = requireAuth(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const projectId = c.req.param('projectId');
  if (!projectId) {
    return c.json({ error: 'Project ID is required' }, 400);
  }

  try {
    let project = null;

    // Try Buckets first
    try {
      const projectData = await smartBuckets.get('projects', `${userId}/${projectId}`, c.env);
      console.log('[Projects] Raw project data from bucket:', JSON.stringify(projectData));
      
      // Handle different data formats from SmartBuckets
      // smartBuckets.get() should have already converted metadata to content via .text()/.json()
      // But if we still get metadata, it means the conversion failed
      if (projectData) {
        // Check if it's still metadata (has key, size, etag but no id/name)
        if (projectData.key && projectData.size && !projectData.id && !projectData.name) {
          console.warn('[Projects] Got metadata object - content reading may have failed');
          console.warn('[Projects] Metadata keys:', Object.keys(projectData));
          // smartBuckets.get() should have handled this, but if we're here, it didn't
          project = null;
        } else if (projectData.id || projectData.name) {
          // This is the actual project data (has id or name)
          project = projectData;
          console.log('[Projects] Project found in bucket:', projectId, 'userId:', project?.user_id || project?.userId);
        } else {
          // Unknown format, try to use it anyway
          console.warn('[Projects] Unknown project data format, attempting to use:', Object.keys(projectData));
          project = projectData;
        }
      }
    } catch (e) {
      console.warn('[Projects] Bucket get failed:', e);
    }

    // SmartSQL disabled - using SmartBuckets only

    if (!project) {
      console.log('[Projects] Project not found. Searched for key:', `${userId}/${projectId}`);
      console.log('[Projects] UserId from token:', userId);
      console.log('[Projects] ProjectId from URL:', projectId);
      
      // Try listing all projects for this user to see what keys exist
      try {
        const allKeys = await smartBuckets.list('projects', `${userId}/`, c.env);
        console.log('[Projects] Available project keys for user:', allKeys);
      } catch (e) {
        console.warn('[Projects] Failed to list projects:', e);
      }
      
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.user_id !== userId && project.userId !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    console.log('[Projects] Project found:', projectId);

    // Get risk score
    const { calculateRiskScoreFromVultr } = await import('../services/vultrClient');
    const { getProjectRiskScore } = await import('../services/riskLogic');
    const { getLogsForProject } = await import('../routes/ingest');

    const projectLogs = await getLogsForProject(projectId);
    let riskScore;
    try {
      riskScore = await calculateRiskScoreFromVultr({ projectId, logs: projectLogs });
    } catch (error) {
      console.warn('[Projects] Vultr worker unavailable, using local calculation');
      riskScore = getProjectRiskScore(projectLogs);
    }

    return c.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        createdAt: project.created_at || project.createdAt,
        updatedAt: project.updated_at || project.updatedAt,
      },
      riskScore,
    });
  } catch (error: any) {
    console.error('[Projects] Get project error:', error?.message || error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.post('/api/projects', async (c: Context<{ Bindings: Env }>) => {
  const userId = requireAuth(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const body = await c.req.json();
    const { name, description } = body;

    if (!name) {
      return c.json({ error: 'Project name is required' }, 400);
    }

    const projectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const projectData = {
      id: projectId,
      user_id: userId,
      userId,
      name,
      description: description || '',
      created_at: now,
      updated_at: now
    };

    // Store in Buckets (Primary)
    await smartBuckets.put('projects', `${userId}/${projectId}`, projectData, c.env);
    console.log('[Projects] Project created in Buckets');

    return c.json({
      project: {
        id: projectId,
        userId,
        name,
        description: description || '',
        createdAt: now,
        updatedAt: now,
      }
    }, 201);
  } catch (error: any) {
    console.error('[Projects] Create project error:', error?.message || error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.put('/api/projects/:projectId', async (c: Context<{ Bindings: Env }>) => {
  const userId = requireAuth(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const projectId = c.req.param('projectId');
  if (!projectId) {
    return c.json({ error: 'Project ID is required' }, 400);
  }

  try {
    const key = `${userId}/${projectId}`;
    let project = await smartBuckets.get('projects', key, c.env);
    
    // SmartSQL disabled - using SmartBuckets only

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.user_id !== userId && project.userId !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const { name, description } = body;

    const updatedName = name || project.name;
    const updatedDesc = description !== undefined ? description : project.description;
    const now = new Date().toISOString();

    const updatedProject = {
      ...project,
      name: updatedName,
      description: updatedDesc,
      updated_at: now,
      updatedAt: now
    };

    // Update Buckets (Primary)
    await smartBuckets.put('projects', key, updatedProject, c.env);

    return c.json({
      project: {
        id: updatedProject.id,
        name: updatedProject.name,
        description: updatedProject.description,
        createdAt: updatedProject.created_at || updatedProject.createdAt,
        updatedAt: updatedProject.updated_at || updatedProject.updatedAt,
      }
    });
  } catch (error: any) {
    console.error('[Projects] Update project error:', error?.message || error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.delete('/api/projects/:projectId', async (c: Context<{ Bindings: Env }>) => {
  const userId = requireAuth(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const projectId = c.req.param('projectId');
  if (!projectId) {
    return c.json({ error: 'Project ID is required' }, 400);
  }

  try {
    const key = `${userId}/${projectId}`;
    let project = await smartBuckets.get('projects', key, c.env);

    // SmartSQL disabled - using SmartBuckets only

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.user_id !== userId && project.userId !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // Delete from Buckets
    await smartBuckets.delete('projects', key, c.env);

    return c.json({ message: 'Project deleted successfully' });
  } catch (error: any) {
    console.error('[Projects] Delete project error:', error?.message || error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// === Ingest Routes ===
app.post('/api/ingest/:projectId', async (c: Context<{ Bindings: Env }>) => {
  const userId = requireAuth(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const projectId = c.req.param('projectId');
    const body = await c.req.json();
    const { logs: logContent, metadata } = body;

    if (!projectId) {
      return c.json({ error: 'Project ID is required' }, 400);
    }

    if (!logContent || (typeof logContent !== 'string' && !Array.isArray(logContent))) {
      return c.json({ error: 'Logs content is required (string or array)' }, 400);
    }

    const logEntries = Array.isArray(logContent) 
      ? logContent 
      : logContent.split('\n').filter((line: string) => line.trim());

    const timestamp = new Date().toISOString();
    const storedLogs = logEntries.map((entry: any, index: number) => {
      const logId = `log_${Date.now()}_${index}`;
      return {
        id: logId,
        projectId,
        content: typeof entry === 'string' ? entry : JSON.stringify(entry),
        timestamp,
        metadata: metadata || {},
      };
    });

    console.log(`[Ingest] ↘️ Received ${storedLogs.length} entries for ${projectId}`);
    await ingestRoutes.storeLogs(projectId, storedLogs, c.env);
    console.log(`[Ingest] ✅ Stored ${storedLogs.length} logs successfully`);

    // Get all logs and calculate risk score
    console.log('[Ingest] 🔍 Getting all logs for risk scoring...');
    let projectLogs = await ingestRoutes.getLogs(projectId, c.env);

    if (projectLogs.length === 0 && storedLogs.length > 0) {
      console.warn(`[Ingest] ⚠️ getLogs returned 0 entries. Using freshly stored logs for scoring.`);
      projectLogs = storedLogs;
    }

    const projectLogsForScoring = projectLogs.map((log: any) => ({
      content: log.content,
      timestamp: log.timestamp,
      metadata: log.metadata,
    }));

    let riskScore = null;
    console.log(`[Ingest] 🧮 Calculating risk score for ${projectLogsForScoring.length} logs`);
    try {
      const { calculateRiskScoreFromVultr } = await import('../services/vultrClient');
      const { getProjectRiskScore } = await import('../services/riskLogic');
      
      try {
        riskScore = await calculateRiskScoreFromVultr({
          projectId,
          logs: projectLogsForScoring,
        });
      } catch (error) {
        console.warn('Vultr worker unavailable, using local calculation:', error);
        riskScore = getProjectRiskScore(projectLogsForScoring);
      }
      
      console.log('[Ingest] 💾 Storing risk score...');
      await ingestRoutes.storeRiskScore(projectId, riskScore, c.env);
      console.log('[Ingest] ✅ Risk score stored');
    } catch (error) {
      console.error('Error calculating risk score:', error);
    }

    return c.json({
      message: `Ingested ${storedLogs.length} log entries`,
      count: storedLogs.length,
      projectId,
      timestamp,
      riskScore,
    }, 201);
  } catch (error: any) {
    console.error('Ingest error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.get('/api/ingest/:projectId', async (c: Context<{ Bindings: Env }>) => {
  const userId = requireAuth(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const projectId = c.req.param('projectId');
  if (!projectId) {
    return c.json({ error: 'Project ID is required' }, 400);
  }

  try {
    const projectLogs = await ingestRoutes.getLogs(projectId, c.env);
    
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const paginatedLogs = projectLogs.slice(offset, offset + limit);

    return c.json({
      logs: paginatedLogs,
      total: projectLogs.length,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Get logs error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// === Forecast Routes ===
app.get('/api/forecast/:projectId', async (c: Context<{ Bindings: Env }>) => {
  const userId = requireAuth(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const projectId = c.req.param('projectId');
  if (!projectId) {
    return c.json({ error: 'Project ID is required' }, 400);
  }

  try {
    const date = c.req.query('date') || new Date().toISOString().split('T')[0];
    const { generateForecast } = await import('../services/forecastService');
    const { smartBuckets, smartInference } = await import('../services/raindropSmart');

    // Check if forecast exists
    const bucket = 'forecasts';
    const key = `${projectId}/${date}`;
    let forecast = await smartBuckets.get(bucket, key, c.env);

    if (!forecast || shouldRegenerateForecast(forecast)) {
      try {
        const inferenceResult = await smartInference.run('forecast_generation', {
          projectId,
          date,
        });
        
        if (inferenceResult && inferenceResult.forecastText) {
          forecast = {
            id: `forecast_${projectId}_${date}`,
            projectId,
            date,
            forecastText: inferenceResult.forecastText,
            actions: inferenceResult.actions || [],
            riskScore: inferenceResult.riskScore || 0,
            confidence: inferenceResult.confidence || 50,
            generatedAt: new Date().toISOString(),
          };
        } else {
          forecast = await generateForecast(projectId, date);
        }
        
        await smartBuckets.put(bucket, key, forecast, c.env);
      } catch (error: any) {
        console.error('Forecast generation error:', error);
        forecast = await generateForecast(projectId, date);
        await smartBuckets.put(bucket, key, forecast, c.env);
      }
    }

    return c.json({ forecast });
  } catch (error: any) {
    console.error('Get forecast error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.get('/api/forecast/:projectId/history', async (c: Context<{ Bindings: Env }>) => {
  const userId = requireAuth(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const projectId = c.req.param('projectId');
  if (!projectId) {
    return c.json({ error: 'Project ID is required' }, 400);
  }

  try {
    const { smartBuckets } = await import('../services/raindropSmart');
    const bucket = 'forecasts';
    const prefix = `${projectId}/`;
    const keys = await smartBuckets.list(bucket, prefix, c.env);
    
    const forecasts = [];
    for (const key of keys.slice(-30)) {
      const forecast = await smartBuckets.get(bucket, key, c.env);
      if (forecast) {
        forecasts.push(forecast);
      }
    }
    
    forecasts.sort((a: any, b: any) => b.date.localeCompare(a.date));

    return c.json({ forecasts: forecasts.slice(0, 30) });
  } catch (error: any) {
    console.error('Get forecast history error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.get('/api/forecast/:projectId/risk-history', async (c: Context<{ Bindings: Env }>) => {
  const userId = requireAuth(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const projectId = c.req.param('projectId');
  if (!projectId) {
    return c.json({ error: 'Project ID is required' }, 400);
  }

  try {
    const limit = parseInt(c.req.query('limit') || '30');
    const { getRiskHistory } = await import('../routes/ingest');
    const history = await getRiskHistory(projectId, limit);

    return c.json({
      history: history.map((h: any) => ({
        score: h.score,
        timestamp: h.timestamp,
        labels: h.labels,
      })),
    });
  } catch (error: any) {
    console.error('Get risk history error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

function shouldRegenerateForecast(forecast: any): boolean {
  const generatedAt = new Date(forecast.generatedAt);
  const now = new Date();
  const hoursSinceGeneration = (now.getTime() - generatedAt.getTime()) / (1000 * 60 * 60);
  return hoursSinceGeneration > 24;
}

// === Database Initialization ===
async function initDatabase(db: any): Promise<boolean> {
  try {
    console.log('[CloudSage] Initializing database tables...');

    // Create tables using SmartSQL executeQuery with textQuery
    // Wrap each in try-catch to handle existing tables gracefully
    try {
      await db.executeQuery({
        textQuery: `CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TEXT,
          updated_at TEXT
        )`,
        format: 'json'
      });
    } catch (e) {
      console.log('[CloudSage] Users table already exists or error:', e);
    }

    try {
      await db.executeQuery({
        textQuery: `CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          created_at TEXT,
          updated_at TEXT
        )`,
        format: 'json'
      });
    } catch (e) {
      console.log('[CloudSage] Projects table already exists or error:', e);
    }

    try {
      await db.executeQuery({
        textQuery: `CREATE TABLE IF NOT EXISTS risk_history (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          score INTEGER NOT NULL,
          labels TEXT,
          factors TEXT,
          timestamp TEXT
        )`,
        format: 'json'
      });
    } catch (e) {
      console.log('[CloudSage] Risk_history table already exists or error:', e);
    }

    console.log('[CloudSage] ✓ Database initialization complete');
    return true;
  } catch (error: any) {
    console.error('[CloudSage] Database initialization failed:', error?.message || error);
    console.log('[CloudSage] ⚠ Continuing without database (will use SmartBuckets)');
    return false;
  }
}

// === Service Handler ===
export default class extends Service<Env> {
  private dbInitialized = false;

  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    try {
      console.log('[Service] fetch called');
      console.log('[Service] env param exists:', !!env);

      // Try to get env from this or parameter
      const actualEnv = env || (this as any).env;
      console.log('[Service] actualEnv exists:', !!actualEnv);

      // Skip database initialization - use SmartBuckets only for hackathon
      // Database initialization can cause issues with foreign key constraints
      console.log('[CloudSage] Using SmartBuckets for storage (database initialization skipped)');

      console.log('[Service] Calling app.fetch with actualEnv:', !!actualEnv);
      // Pass context directly to Hono
      const response = await app.fetch(request, actualEnv, ctx);
      console.log('[Service] app.fetch returned, status:', response.status);
      return response;
    } catch (error) {
      console.error('[CloudSage] Service fetch error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}
