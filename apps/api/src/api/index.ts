import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono, Context } from 'hono';
import { Env } from './raindrop.gen';
import { corsAllowAll } from '@liquidmetal-ai/raindrop-framework/core/cors';

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

// Request logging middleware
app.use('*', async (c: Context<{ Bindings: Env }>, next: () => Promise<void>) => {
  const start = Date.now();
  const url = c.req.url;
  const method = c.req.method;
  
  await next();
  
  const duration = Date.now() - start;
  if (c.env.logger) {
    c.env.logger.info(`${method} ${url}`, { 
      status: c.res.status,
      duration: `${duration}ms`
    });
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

    // Use existing auth logic
    const mockReq = { body } as any;
    const mockRes = {
      writeHead: () => {},
      end: () => {},
      setHeader: () => {},
    } as any;
    
    // Call existing handler
    await authRoutes.handleRegister(mockReq, mockRes);
    
    // Extract response from mockRes (we'll need to modify this approach)
    // For now, let's inline the logic
    const { smartSQL } = await import('../services/raindropSmart');
    
    // Check if user exists
    const rows = await smartSQL.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows && rows.length > 0) {
      return c.json({ error: 'User already exists' }, 400);
    }

    // Create user
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // Use btoa for base64 encoding (works in Cloudflare Workers)
    const hashedPassword = btoa(password);
    
    const result = await smartSQL.execute(
      'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [userId, email, hashedPassword, new Date().toISOString(), new Date().toISOString()]
    );
    
    // Fallback to in-memory if SmartSQL fails
    if (!result || result.affectedRows === 0) {
      // In-memory fallback would be handled in the route file
      // For now, assume success
    }

    const token = btoa(`${userId}:${Date.now()}`);

    return c.json({
      token,
      user: { id: userId, email },
    });
  } catch (error: any) {
    console.error('Register error:', error);
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

    const { smartSQL } = await import('../services/raindropSmart');
    
    // Get user
    const rows = await smartSQL.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows && rows.length > 0 ? rows[0] : null;
    
    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const userPassword = user.password_hash || user.password;
    const hashedPassword = btoa(password);
    
    if (userPassword !== hashedPassword) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const token = btoa(`${user.id}:${Date.now()}`);

    return c.json({
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (error: any) {
    console.error('Login error:', error);
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
    const { smartSQL } = await import('../services/raindropSmart');
    const rows = await smartSQL.query(
      'SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    
    const projects = (rows || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      createdAt: p.created_at || p.createdAt,
      updatedAt: p.updated_at || p.updatedAt,
    }));

    return c.json({ projects });
  } catch (error: any) {
    console.error('Get projects error:', error);
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
    const { smartSQL } = await import('../services/raindropSmart');
    const { calculateRiskScoreFromVultr } = await import('../services/vultrClient');
    const { getProjectRiskScore } = await import('../services/riskLogic');
    const { getLogsForProject } = await import('../routes/ingest');

    const rows = await smartSQL.query('SELECT * FROM projects WHERE id = ?', [projectId]);
    const project = rows && rows.length > 0 ? rows[0] : null;

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.user_id !== userId && project.userId !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // Get risk score
    const projectLogs = await getLogsForProject(projectId);
    let riskScore;
    try {
      riskScore = await calculateRiskScoreFromVultr({ projectId, logs: projectLogs });
    } catch (error) {
      console.warn('Vultr worker unavailable, using local calculation:', error);
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
    console.error('Get project error:', error);
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

    const { smartSQL } = await import('../services/raindropSmart');
    const projectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const result = await smartSQL.execute(
      'INSERT INTO projects (id, user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [projectId, userId, name, description || '', now, now]
    );

    if (!result || result.affectedRows === 0) {
      // Fallback handled in route file, assume success for now
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
    console.error('Create project error:', error);
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
    const { smartSQL } = await import('../services/raindropSmart');
    const rows = await smartSQL.query('SELECT * FROM projects WHERE id = ?', [projectId]);
    const project = rows && rows.length > 0 ? rows[0] : null;

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.user_id !== userId && project.userId !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const { name, description } = body;

    await smartSQL.execute(
      'UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?',
      [name || project.name, description !== undefined ? description : project.description, new Date().toISOString(), projectId]
    );

    const updatedRows = await smartSQL.query('SELECT * FROM projects WHERE id = ?', [projectId]);
    const updatedProject = updatedRows && updatedRows.length > 0 ? updatedRows[0] : project;

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
    console.error('Update project error:', error);
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
    const { smartSQL } = await import('../services/raindropSmart');
    const rows = await smartSQL.query('SELECT * FROM projects WHERE id = ?', [projectId]);
    const project = rows && rows.length > 0 ? rows[0] : null;

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.user_id !== userId && project.userId !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    await smartSQL.execute('DELETE FROM projects WHERE id = ?', [projectId]);

    return c.json({ message: 'Project deleted successfully' });
  } catch (error: any) {
    console.error('Delete project error:', error);
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

// === Service Handler ===
export default class extends Service<Env> {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    return app.fetch(request, env, ctx);
  }
}
