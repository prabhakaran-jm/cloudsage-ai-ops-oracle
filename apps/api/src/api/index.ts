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
  console.log('[CloudSage] c.env.MAIN_DB exists:', !!c.env?.MAIN_DB);
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
    const { email, password } = body;

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    console.log('[Auth] Registration attempt for email:', email);

    // Check SmartBuckets first
    const existingUser = await smartBuckets.get('users', email);
    if (existingUser) {
      console.log('[Auth] User already exists (Bucket):', email);
      return c.json({ error: 'User already exists' }, 400);
    }

    const db = c.env?.MAIN_DB as any;
    
    // Check SQL as backup if available
    if (db) {
      try {
        const checkResult = await db.executeQuery({
          textQuery: `SELECT * FROM users WHERE email = '${email.replace(/'/g, "''")}'`,
          format: 'json'
        });

        if (checkResult.results && checkResult.results.length > 0) {
          console.log('[Auth] User already exists (SQL):', email);
          return c.json({ error: 'User already exists' }, 400);
        }
      } catch (e) {
        console.warn('[Auth] SQL check failed, proceeding:', e);
      }
    }

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
    await smartBuckets.put('users', email, userData);
    console.log('[Auth] User created in SmartBuckets:', email);

    // Store in SQL (Secondary/Backup)
    if (db) {
      try {
        await db.executeQuery({
          textQuery: `INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES ('${userId}', '${email.replace(/'/g, "''")}', '${hashedPassword}', '${now}', '${now}')`,
          format: 'json'
        });
        console.log('[Auth] User mirrored to SQL:', email);
      } catch (e) {
        console.warn('[Auth] SQL insert failed (non-critical):', e);
      }
    }

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
    const { email, password } = body;

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    console.log('[Auth] Login attempt for email:', email);

    // Try SmartBuckets first (Primary)
    let user = await smartBuckets.get('users', email);

    // Fallback to SQL if not found in Buckets
    if (!user) {
      console.log('[Auth] User not found in Buckets, checking SQL:', email);
      const db = c.env?.MAIN_DB as any;
      if (db) {
        try {
          const result = await db.executeQuery({
            textQuery: `SELECT * FROM users WHERE email = '${email.replace(/'/g, "''")}'`,
            format: 'json'
          });
          
          if (result.results && result.results.length > 0) {
            user = result.results[0];
            console.log('[Auth] User found in SQL fallback');
          }
        } catch (e) {
          console.warn('[Auth] SQL check failed:', e);
        }
      }
    }

    if (!user) {
      console.log('[Auth] User not found:', email);
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    console.log('[Auth] User found:', JSON.stringify({ ...user, password_hash: '[REDACTED]' }));
    const userPassword = user.password_hash || user.password;
    const hashedPassword = btoa(password);
    
    if (userPassword !== hashedPassword) {
      console.log('[Auth] Password mismatch for:', email);
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const token = btoa(`${user.id}:${Date.now()}`);

    console.log('[Auth] Login successful for:', email);
    return c.json({
      token,
      user: { id: user.id, email: user.email },
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
      const keys = await smartBuckets.list('projects', `${userId}/`);
      if (keys && keys.length > 0) {
        for (const key of keys) {
          const p = await smartBuckets.get('projects', key);
          if (p) projects.push(p);
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

    // Fallback to SQL if empty
    if (projects.length === 0) {
      const db = c.env?.MAIN_DB as any;
      if (db) {
        try {
          const result = await db.executeQuery({
            query: `SELECT * FROM projects WHERE user_id = '${userId.replace(/'/g, "''")}' ORDER BY created_at DESC`
          });

          const rows = result?.rows || [];
          if (rows.length > 0) {
            projects = rows;
            console.log(`[Projects] Found ${rows.length} projects in SQL for user:`, userId);
          }
        } catch (e) {
          console.warn('[Projects] SQL list failed:', e);
        }
      }
    }

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
      project = await smartBuckets.get('projects', `${userId}/${projectId}`);
    } catch (e) {
      console.warn('[Projects] Bucket get failed:', e);
    }

    // Fallback to SQL
    if (!project) {
      const db = c.env?.MAIN_DB as any;
      if (db) {
        try {
          const result = await db.executeQuery({
            query: `SELECT * FROM projects WHERE id = '${projectId.replace(/'/g, "''")}'`
          });
          const rows = result?.rows || [];
          project = rows && rows.length > 0 ? rows[0] : null;
        } catch (e) {
          console.warn('[Projects] SQL get failed:', e);
        }
      }
    }

    if (!project) {
      console.log('[Projects] Project not found:', projectId);
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
    await smartBuckets.put('projects', `${userId}/${projectId}`, projectData);
    console.log('[Projects] Project created in Buckets');

    // Store in SQL (Secondary)
    const db = c.env?.MAIN_DB as any;
    if (db) {
      try {
        await db.executeQuery({
          query: `INSERT INTO projects (id, user_id, name, description, created_at, updated_at) VALUES ('${projectId}', '${userId.replace(/'/g, "''")}', '${name.replace(/'/g, "''")}', '${(description || '').replace(/'/g, "''")}', '${now}', '${now}')`
        });
        console.log('[Projects] Project mirrored to SQL');
      } catch (e) {
        console.warn('[Projects] SQL insert failed:', e);
      }
    }

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
    let project = await smartBuckets.get('projects', key);
    
    // Check SQL if not in bucket
    if (!project) {
      const db = c.env?.MAIN_DB as any;
      if (db) {
        try {
          const rows = await db.executeQuery(`SELECT * FROM projects WHERE id = '${projectId.replace(/'/g, "''")}'`);
          if (rows && rows.length > 0) project = rows[0];
        } catch (e) {
          console.warn('[Projects] SQL get failed:', e);
        }
      }
    }

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
    await smartBuckets.put('projects', key, updatedProject);

    // Update SQL (Secondary)
    const db = c.env?.MAIN_DB as any;
    if (db) {
      try {
        await db.executeQuery({
          query: `UPDATE projects SET name = '${updatedName.replace(/'/g, "''")}', description = '${updatedDesc.replace(/'/g, "''")}', updated_at = '${now}' WHERE id = '${projectId.replace(/'/g, "''")}'`
        });
      } catch (e) {
        console.warn('[Projects] SQL update failed:', e);
      }
    }

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
    let project = await smartBuckets.get('projects', key);

    // Check SQL if not in bucket
    if (!project) {
      const db = c.env?.MAIN_DB as any;
      if (db) {
        try {
          const result = await db.executeQuery({
            query: `SELECT * FROM projects WHERE id = '${projectId.replace(/'/g, "''")}'`
          });
          const rows = result?.rows || [];
          if (rows && rows.length > 0) project = rows[0];
        } catch (e) {
          console.warn('[Projects] SQL get failed:', e);
        }
      }
    }

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.user_id !== userId && project.userId !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // Delete from Buckets
    await smartBuckets.delete('projects', key);

    // Delete from SQL
    const db = c.env?.MAIN_DB as any;
    if (db) {
      try {
        await db.executeQuery({
          query: `DELETE FROM projects WHERE id = '${projectId.replace(/'/g, "''")}'`
        });
      } catch (e) {
        console.warn('[Projects] SQL delete failed:', e);
      }
    }

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

    const { smartBuckets } = await import('../services/raindropSmart');
    const bucket = 'logs';
    for (const entry of storedLogs) {
      const key = `${projectId}/${entry.timestamp}/${entry.id}`;
      await smartBuckets.put(bucket, key, entry);
    }

    // Get all logs and calculate risk score
    const { getLogs } = await import('../routes/ingest');
    const projectLogs = await getLogs(projectId);
    const projectLogsForScoring = projectLogs.map((log: any) => ({
      content: log.content,
      timestamp: log.timestamp,
      metadata: log.metadata,
    }));

    let riskScore = null;
    try {
      const { calculateRiskScoreFromVultr } = await import('../services/vultrClient');
      const { getProjectRiskScore } = await import('../services/riskLogic');
      const { storeRiskScore } = await import('../routes/ingest');
      
      try {
        riskScore = await calculateRiskScoreFromVultr({
          projectId,
          logs: projectLogsForScoring,
        });
      } catch (error) {
        console.warn('Vultr worker unavailable, using local calculation:', error);
        riskScore = getProjectRiskScore(projectLogsForScoring);
      }
      
      await storeRiskScore(projectId, riskScore);
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
    const { getLogs } = await import('../routes/ingest');
    const projectLogs = await getLogs(projectId);
    
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
    let forecast = await smartBuckets.get(bucket, key);

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
        
        await smartBuckets.put(bucket, key, forecast);
      } catch (error: any) {
        console.error('Forecast generation error:', error);
        forecast = await generateForecast(projectId, date);
        await smartBuckets.put(bucket, key, forecast);
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
    const keys = await smartBuckets.list(bucket, prefix);
    
    const forecasts = [];
    for (const key of keys.slice(-30)) {
      const forecast = await smartBuckets.get(bucket, key);
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

    console.log('[CloudSage] ✓ Database tables created');
    return true;
  } catch (error: any) {
    console.error('[CloudSage] Database initialization failed:', error?.message || error);
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
      console.log('[Service] this.env exists:', !!(this as any).env);
      console.log('[Service] typeof this:', typeof this);
      console.log('[Service] this keys:', Object.keys(this).join(', '));

      // Try to get env from this or parameter
      const actualEnv = env || (this as any).env;
      console.log('[Service] actualEnv exists:', !!actualEnv);
      console.log('[Service] actualEnv type:', typeof actualEnv);

      if (actualEnv) {
        console.log('[Service] actualEnv keys:', Object.keys(actualEnv).join(', '));
        console.log('[Service] actualEnv.MAIN_DB exists:', !!actualEnv.MAIN_DB);
      }

      // Initialize database on first request
      if (!this.dbInitialized && actualEnv?.MAIN_DB) {
        this.dbInitialized = true;
        console.log('[CloudSage] Initializing database...');
        await initDatabase(actualEnv.MAIN_DB).catch((error) => {
          console.error('[CloudSage] Failed to initialize database:', error);
        });
      }

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
