import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono, Context } from 'hono';
import { Env } from './raindrop.gen';
import { smartBuckets, smartSQL } from '../services/raindropSmart';
import { SignJWT, jwtVerify } from 'jose';
import {
  authSchema,
  projectCreateSchema,
  projectUpdateSchema,
  ingestBodySchema,
  forecastQuerySchema,
  historyQuerySchema,
  ingestQuerySchema,
} from '../schemas';

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
type AppEnv = Env & {
  JWT_SECRET?: string;
};

const globalAny = globalThis as any;
const DB_INIT_FLAG = '__cloudsage_db_init__';
let dbInitialized = !!globalAny[DB_INIT_FLAG];

// Create Hono app
const app = new Hono<{ Bindings: AppEnv }>();

// CORS middleware - handled by Raindrop framework via _app/cors.ts
// No need to add here as it's application-wide

// Request logging middleware
app.use('*', async (c: Context<{ Bindings: AppEnv }>, next: () => Promise<void>) => {
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
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 100;
const rateLimits = new Map<string, { count: number; windowStart: number }>();

function getClientKey(c: Context<{ Bindings: AppEnv }>): string {
  return (
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for') ||
    c.req.header('x-real-ip') ||
    'anonymous'
  );
}

app.use('*', async (c, next) => {
  const key = getClientKey(c);
  const now = Date.now();
  const entry = rateLimits.get(key) || { count: 0, windowStart: now };
  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count += 1;
  rateLimits.set(key, entry);

  if (entry.count > RATE_LIMIT_MAX) {
    return c.json({ error: 'Too many requests' }, 429);
  }

  await next();
});

function getJwtSecret(env?: Partial<AppEnv>): string {
  return (
    env?.JWT_SECRET ||
    (typeof process !== 'undefined' ? process.env.JWT_SECRET : '') ||
    'change-me-dev-secret'
  );
}

function getJwtKey(env?: Partial<AppEnv>): Uint8Array {
  return new TextEncoder().encode(getJwtSecret(env));
}

async function signToken(userId: string, env?: Partial<AppEnv>): Promise<string> {
  const key = getJwtKey(env);
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(key);
}

async function getUserIdFromToken(authHeader: string | undefined, env?: Partial<AppEnv>): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  try {
    const token = authHeader.substring(7);
    const key = getJwtKey(env);
    const { payload } = await jwtVerify(token, key);
    return (payload as any).userId || null;
  } catch (err) {
    return null;
  }
}

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  // Edge runtime only supports iterations up to 100k; keep within limit.
  const iterations = 100000;
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    key,
    32 * 8
  );
  return `pbkdf2$${iterations}$${toBase64(salt)}$${toBase64(derived)}`;
}

async function verifyPassword(stored: string, password: string): Promise<boolean> {
  if (stored?.startsWith('pbkdf2$')) {
    const parts = stored.split('$');
    const iterations = parseInt(parts[1], 10);
    const salt = fromBase64(parts[2]);
    const expected = parts[3];

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const derived = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256',
      },
      key,
      32 * 8
    );
    return toBase64(derived) === expected;
  }

  // Legacy base64 fallback
  try {
    return stored === btoa(password);
  } catch {
    return false;
  }
}

let hasMigrated = false;
async function migrateBucketsToSmartSQL(env?: Partial<AppEnv>) {
  if (hasMigrated) return;
  hasMigrated = true;
  try {
    // If SmartSQL is unavailable, skip migration
    const rows = await smartSQL.query('SELECT 1', [], env as any).catch(() => null);
    if (!rows) return;

    // Migrate users
    try {
      const userKeys = await smartBuckets.list('users', '', env as any);
      for (const key of userKeys) {
        const user = await smartBuckets.get('users', key, env as any);
        if (!user?.email || !user?.password_hash && !user?.password) continue;
        const existing = await smartSQL.query('SELECT id FROM users WHERE email = ?', [user.email], env as any);
        if (existing?.length) continue;
        const passwordHash = user.password_hash || user.password;
        await smartSQL.execute(
          'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [
            user.id || `user_${Date.now()}`,
            user.email,
            passwordHash,
            user.created_at || new Date().toISOString(),
            user.updated_at || new Date().toISOString(),
          ],
          env as any
        );
      }
    } catch (err) {
      console.warn('[Migration] Users migration skipped:', err);
    }

    // Migrate projects
    try {
      const projectKeys = await smartBuckets.list('projects', '', env as any);
      for (const key of projectKeys) {
        const project = await smartBuckets.get('projects', key, env as any);
        if (!project?.id || !(project.user_id || project.userId)) continue;
        const existing = await smartSQL.query('SELECT id FROM projects WHERE id = ?', [project.id], env as any);
        if (existing?.length) continue;
        await smartSQL.execute(
          'INSERT INTO projects (id, user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          [
            project.id,
            project.user_id || project.userId,
            project.name || '',
            project.description || '',
            project.created_at || project.createdAt || new Date().toISOString(),
            project.updated_at || project.updatedAt || new Date().toISOString(),
          ],
          env as any
        );
      }
    } catch (err) {
      console.warn('[Migration] Projects migration skipped:', err);
    }
  } catch (err) {
    console.warn('[Migration] Skipped (SmartSQL unavailable):', err);
  }
}

// Helper to require auth
async function requireAuth(c: Context<{ Bindings: AppEnv }>): Promise<string | null> {
  await migrateBucketsToSmartSQL(c.env);
  const authHeader = c.req.header('authorization');
  const userId = await getUserIdFromToken(authHeader, c.env);
  if (!userId) {
    return null;
  }
  return userId;
}

// Health check
app.get('/health', (c: Context<{ Bindings: AppEnv }>) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API health for badges (alias)
app.get('/api/health', (c: Context<{ Bindings: AppEnv }>) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Vultr infrastructure status
app.get('/api/vultr/status', async (c: Context<{ Bindings: AppEnv }>) => {
  try {
    const { checkVultrWorkerHealth } = await import('../services/vultrClient');
    const startTime = Date.now();
    const isHealthy = await checkVultrWorkerHealth();
    const latency = Date.now() - startTime;
    
    return c.json({
      status: isHealthy ? 'online' : 'offline',
      service: 'Vultr Cloud Compute',
      component: 'Risk Scoring Engine',
      latency: isHealthy ? `${latency}ms` : null,
      region: 'Vultr Cloud',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json({
      status: 'offline',
      service: 'Vultr Cloud Compute',
      component: 'Risk Scoring Engine',
      error: error?.message || 'Connection failed',
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/api/hello', (c: Context<{ Bindings: AppEnv }>) => {
  return c.json({ 
    status: 'ok',
    message: 'Hello from CloudSage API!'
  });
});

// === Auth Routes ===
app.post('/api/auth/register', async (c: Context<{ Bindings: AppEnv }>) => {
  try {
    const body = await c.req.json();
    const parsed = authSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid input', details: parsed.error.format() }, 400);
    }
    let { email, password } = parsed.data;

    // Normalize email
    email = email.toLowerCase().trim();

    console.log('[Auth] Registration attempt for email:', email);

    // Check SmartSQL first
    try {
      const rows = await smartSQL.query('SELECT id FROM users WHERE email = ?', [email], c.env);
      if (rows?.length) {
        return c.json({ error: 'User already exists' }, 400);
      }
    } catch (err) {
      console.warn('[Auth] SmartSQL check failed, falling back to bucket:', err);
    }

    // Check SmartBuckets fallback
    const existingUser = await smartBuckets.get('users', email, c.env);
    if (existingUser) {
      console.log('[Auth] User already exists (Bucket):', email);
      return c.json({ error: 'User already exists' }, 400);
    }

    // SmartSQL disabled - using SmartBuckets only
    // Removed MAIN_DB checks to avoid foreign key constraint errors

    // Create user
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const hashedPassword = await hashPassword(password);
    const now = new Date().toISOString();

    const userData = {
      id: userId,
      email,
      password_hash: hashedPassword,
      created_at: now,
      updated_at: now
    };

    // Store in SmartSQL primary
    try {
      await smartSQL.execute(
        'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [userId, email, hashedPassword, now, now],
        c.env
      );
      console.log('[Auth] User created in SmartSQL:', email);
      // Also store in SmartBuckets for resilience
      try {
        await smartBuckets.put('users', email, userData, c.env);
      } catch (e) {
        console.warn('[Auth] Failed to write user to SmartBuckets (secondary):', e);
      }
    } catch (err) {
      console.warn('[Auth] SmartSQL insert failed, storing in SmartBuckets fallback:', err);
    await smartBuckets.put('users', email, userData, c.env);
    console.log('[Auth] User created in SmartBuckets:', email);
    }

    const token = await signToken(userId, c.env);

    return c.json({
      token,
      user: { id: userId, email },
    });
  } catch (error: any) {
    console.error('[Auth] Registration error:', error?.message || error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.post('/api/auth/login', async (c: Context<{ Bindings: AppEnv }>) => {
  try {
    const body = await c.req.json();
    const parsed = authSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid input', details: parsed.error.format() }, 400);
    }
    let { email, password } = parsed.data;

    // Normalize email
    email = email.toLowerCase().trim();

    console.log('[Auth] Login attempt for email:', email);

    // Try SmartSQL first
    let user = null;
    try {
      const rows = await smartSQL.query('SELECT * FROM users WHERE email = ?', [email], c.env);
      if (rows?.length) {
        const u = rows[0];
        user = {
          id: u.id,
          email: u.email,
          password_hash: u.password_hash,
        };
      }
    } catch (err) {
      console.warn('[Auth] SmartSQL query failed, falling back to bucket:', err);
    }

    // Try SmartBuckets (fallback)
    if (!user) {
      user = await smartBuckets.get('users', email, c.env);
    }

    if (!user) {
      console.log('[Auth] User not found:', email);
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    console.log('[Auth] User found:', JSON.stringify({ ...user, password_hash: '[REDACTED]' }));
    console.log('[Auth] User object keys:', Object.keys(user));
    
    // Handle different data formats from SmartBuckets
    const actualUser = user.value || user.data || user;
    const userPassword = actualUser.password_hash || actualUser.password || user.password_hash || user.password;
    
    console.log('[Auth] Comparing passwords - stored length:', userPassword?.length);
    
    const passwordOk = userPassword ? await verifyPassword(userPassword, password) : false;

    if (!passwordOk) {
      console.log('[Auth] Password mismatch for:', email);
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    
    // Use actualUser for id and email
    const userIdForToken = actualUser.id || user.id;
    const userEmailForResponse = actualUser.email || user.email;

    const token = await signToken(userIdForToken, c.env);

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

app.post('/api/auth/logout', (c: Context<{ Bindings: AppEnv }>) => {
  return c.json({ message: 'Logged out successfully' });
});

// Stripe checkout login - create/login user after Stripe payment
app.post('/api/auth/stripe-login', async (c: Context<{ Bindings: AppEnv }>) => {
  try {
    const body = await c.req.json();
    const { email } = body;

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    console.log('[Auth] Stripe checkout login attempt for email:', normalizedEmail);

    // Try to find existing user
    let user = null;
    try {
      const rows = await smartSQL.query('SELECT * FROM users WHERE email = ?', [normalizedEmail], c.env);
      if (rows?.length) {
        user = rows[0];
      }
    } catch (err) {
      console.warn('[Auth] SmartSQL query failed, trying SmartBuckets:', err);
    }

    // Try SmartBuckets (fallback)
    if (!user) {
      try {
        const bucketUser = await smartBuckets.get('users', normalizedEmail, c.env);
        if (bucketUser) {
          user = bucketUser.value || bucketUser.data || bucketUser;
        }
      } catch (err) {
        console.warn('[Auth] SmartBuckets query failed:', err);
      }
    }

    let userId: string;

    if (user) {
      // User exists, use their ID
      userId = user.id || (user.value || user.data || user).id;
      console.log('[Auth] Existing user found:', normalizedEmail, 'userId:', userId);
    } else {
      // Create new user (Stripe checkout JIT provisioning)
      userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const now = new Date().toISOString();
      
      // Use empty string for password_hash (table has NOT NULL constraint)
      // Empty string indicates passwordless account (Stripe/WorkOS users)
      const passwordHash = '';
      
      const userData = {
        id: userId,
        email: normalizedEmail,
        password_hash: passwordHash,
        created_at: now,
        updated_at: now,
      };

      // Store in SmartSQL
      try {
        await smartSQL.execute(
          'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [userId, normalizedEmail, passwordHash, now, now],
          c.env
        );
        console.log('[Auth] Stripe checkout user created in SmartSQL:', normalizedEmail);
      } catch (err) {
        console.warn('[Auth] SmartSQL insert failed, storing in SmartBuckets:', err);
        await smartBuckets.put('users', normalizedEmail, userData, c.env);
        console.log('[Auth] Stripe checkout user created in SmartBuckets:', normalizedEmail);
      }
    }

    const token = await signToken(userId, c.env);

    console.log('[Auth] Stripe checkout login successful for:', normalizedEmail);
    return c.json({
      token,
      user: { id: userId, email: normalizedEmail },
    });
  } catch (error: any) {
    console.error('[Auth] Stripe checkout login error:', error?.message || error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// WorkOS AuthKit login - exchange WorkOS user for JWT token
app.post('/api/auth/workos-login', async (c: Context<{ Bindings: AppEnv }>) => {
  try {
    const body = await c.req.json();
    const { email, workosUserId } = body;

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    console.log('[Auth] WorkOS login attempt for email:', normalizedEmail);

    // Try to find existing user
    let user = null;
    try {
      const rows = await smartSQL.query('SELECT * FROM users WHERE email = ?', [normalizedEmail], c.env);
      if (rows?.length) {
        user = rows[0];
      }
    } catch (err) {
      console.warn('[Auth] SmartSQL query failed, trying SmartBuckets:', err);
    }

    // Try SmartBuckets (fallback)
    if (!user) {
      try {
        const bucketUser = await smartBuckets.get('users', normalizedEmail, c.env);
        if (bucketUser) {
          user = bucketUser.value || bucketUser.data || bucketUser;
        }
      } catch (err) {
        console.warn('[Auth] SmartBuckets query failed:', err);
      }
    }

    let userId: string;

    if (user) {
      // User exists, use their ID
      userId = user.id || (user.value || user.data || user).id;
      console.log('[Auth] Existing user found:', normalizedEmail, 'userId:', userId);
    } else {
      // Create new user (WorkOS JIT provisioning)
      userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const now = new Date().toISOString();
      
      // Use empty string for password_hash (table has NOT NULL constraint)
      // Empty string indicates passwordless account (WorkOS/Stripe users)
      const passwordHash = '';
      
      const userData = {
        id: userId,
        email: normalizedEmail,
        password_hash: passwordHash,
        workos_user_id: workosUserId || null,
        created_at: now,
        updated_at: now,
      };

      // Store in SmartSQL
      try {
        await smartSQL.execute(
          'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [userId, normalizedEmail, passwordHash, now, now],
          c.env
        );
        console.log('[Auth] WorkOS user created in SmartSQL:', normalizedEmail);
      } catch (err) {
        console.warn('[Auth] SmartSQL insert failed, storing in SmartBuckets:', err);
        await smartBuckets.put('users', normalizedEmail, userData, c.env);
        console.log('[Auth] WorkOS user created in SmartBuckets:', normalizedEmail);
      }
    }

    const token = await signToken(userId, c.env);

    console.log('[Auth] WorkOS login successful for:', normalizedEmail);
    return c.json({
      token,
      user: { id: userId, email: normalizedEmail },
    });
  } catch (error: any) {
    console.error('[Auth] WorkOS login error:', error?.message || error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// === Project Routes ===
app.get('/api/projects', async (c: Context<{ Bindings: AppEnv }>) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  try {
    // Collect projects from SmartSQL (preferred) and Buckets (fallback) then dedupe by id
    const projectMap = new Map<string, any>();

    try {
      const rows = await smartSQL.query(
        'SELECT id, user_id, name, description, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY created_at DESC',
        [userId],
        c.env
      );
      for (const p of rows || []) {
        projectMap.set(p.id, {
          id: p.id,
          name: p.name,
          description: p.description,
          createdAt: p.created_at || p.createdAt,
          updatedAt: p.updated_at || p.updatedAt,
        });
      }
    } catch (err) {
      console.warn('[Projects] SmartSQL list failed, continuing with buckets:', err);
      }

    try {
      const keys = await smartBuckets.list('projects', `${userId}/`, c.env);
      for (const key of keys || []) {
        const p = await smartBuckets.get('projects', key, c.env);
        if (p && (p.id || p.name) && !projectMap.has(p.id)) {
          projectMap.set(p.id, {
      id: p.id,
      name: p.name,
      description: p.description,
      createdAt: p.created_at || p.createdAt,
      updatedAt: p.updated_at || p.updatedAt,
          });
        }
      }
    } catch (err) {
      console.warn('[Projects] Bucket list failed:', err);
    }

    const projects = Array.from(projectMap.values()).sort(
      (a, b) => new Date(b.createdAt || b.created_at).getTime() - new Date(a.createdAt || a.created_at).getTime()
    );

    return c.json({ projects });
  } catch (error: any) {
    console.error('[Projects] Get projects error:', error?.message || error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.get('/api/projects/:projectId', async (c: Context<{ Bindings: AppEnv }>) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const projectId = c.req.param('projectId');
  if (!projectId) {
    return c.json({ error: 'Project ID is required' }, 400);
  }

  try {
    let project = null;

    // SmartSQL primary
    try {
      const rows = await smartSQL.query(
        'SELECT id, user_id, name, description, created_at, updated_at FROM projects WHERE id = ? AND user_id = ?',
        [projectId, userId],
        c.env
      );
      if (rows?.length) {
        const row = rows[0];
        project = {
          id: row.id,
          user_id: row.user_id,
          name: row.name,
          description: row.description,
          created_at: row.created_at || row.createdAt,
          updated_at: row.updated_at || row.updatedAt,
        };
      }
    } catch (e) {
      console.warn('[Projects] SmartSQL get failed, falling back to buckets:', e);
    }

    // Fallback Buckets
    if (!project) {
      const projectData = await smartBuckets.get('projects', `${userId}/${projectId}`, c.env);
      if (projectData && (projectData.id || projectData.name)) {
          project = projectData;
        }
    }

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

    // Try to reuse latest stored risk score before recalculating
    let riskScore: any = null;
    try {
      const rows = await smartSQL.query(
        'SELECT score, labels, factors, timestamp FROM risk_history WHERE project_id = ? ORDER BY timestamp DESC LIMIT 1',
        [projectId],
        c.env
      );
      if (rows?.length) {
        const row = rows[0];
        riskScore = {
          score: row.score,
          labels: typeof row.labels === 'string' ? JSON.parse(row.labels) : row.labels || [],
          factors: typeof row.factors === 'string' ? JSON.parse(row.factors) : row.factors || {},
          timestamp: row.timestamp,
        };
      }
    } catch (err) {
      console.warn('[Projects] Failed to load cached risk score from SmartSQL:', err);
    }
    if (!riskScore) {
      try {
        const { getRiskHistory } = await import('../routes/ingest');
        const history = await getRiskHistory(projectId, 1, c.env);
        if (history?.length) {
          riskScore = history[0];
        }
      } catch (err) {
        console.warn('[Projects] Failed to load cached risk score from buckets/memory:', err);
      }
    }

    // Get risk score
    if (!riskScore) {
    const { calculateRiskScoreFromVultr } = await import('../services/vultrClient');
    const { getProjectRiskScore } = await import('../services/riskLogic');
    const { getLogsForProject } = await import('../routes/ingest');

      const projectLogs = await getLogsForProject(projectId, c.env);
    try {
      riskScore = await calculateRiskScoreFromVultr({ projectId, logs: projectLogs });
    } catch (error) {
      console.warn('[Projects] Vultr worker unavailable, using local calculation');
      riskScore = getProjectRiskScore(projectLogs);
      }

      // Persist newly calculated risk score so subsequent loads are fast
      try {
        const { storeRiskScore } = await import('../routes/ingest');
        if (riskScore) {
          await storeRiskScore(projectId, riskScore, c.env);
        }
      } catch (err) {
        console.warn('[Projects] Failed to persist calculated risk score:', err);
      }
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

app.post('/api/projects', async (c: Context<{ Bindings: AppEnv }>) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const body = await c.req.json();
    const parsed = projectCreateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid input', details: parsed.error.format() }, 400);
    }
    const { name, description } = parsed.data;

    if (!name) {
      return c.json({ error: 'Project name is required' }, 400);
    }

    // Prevent duplicate names per user
    try {
      const existing = await smartSQL.query(
        'SELECT id FROM projects WHERE user_id = ? AND name = ? LIMIT 1',
        [userId, name],
        c.env
      );
      if (existing?.length) {
        return c.json({ error: 'Project name already exists for this user' }, 409);
      }
    } catch (err) {
      console.warn('[Projects] SmartSQL duplicate-name check failed, will rely on bucket check/unique index:', err);
    }

    // Bucket-side duplicate check (fallback)
    try {
      const keys = await smartBuckets.list('projects', `${userId}/`, c.env);
      for (const key of keys || []) {
        const p = await smartBuckets.get('projects', key, c.env);
        if (p && (p.name === name)) {
          return c.json({ error: 'Project name already exists for this user' }, 409);
        }
      }
    } catch (err) {
      console.warn('[Projects] Bucket duplicate-name check failed:', err);
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

    // Store in SmartSQL primary
    try {
      await smartSQL.execute(
        'INSERT INTO projects (id, user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [projectId, userId, name, description || '', now, now],
        c.env
      );
      console.log('[Projects] Project created in SmartSQL');

      // Also store in Buckets for resilience
      try {
    await smartBuckets.put('projects', `${userId}/${projectId}`, projectData, c.env);
      } catch (e) {
        console.warn('[Projects] Failed to write project to Buckets (secondary):', e);
      }
    } catch (err) {
      console.warn('[Projects] SmartSQL insert failed, storing in Buckets:', err);
      await smartBuckets.put('projects', `${userId}/${projectId}`, projectData, c.env);
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

app.put('/api/projects/:projectId', async (c: Context<{ Bindings: AppEnv }>) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const projectId = c.req.param('projectId');
  if (!projectId) {
    return c.json({ error: 'Project ID is required' }, 400);
  }

  try {
    const key = `${userId}/${projectId}`;
    let project: any = null;

    // SmartSQL primary
    try {
      const rows = await smartSQL.query(
        'SELECT id, user_id, name, description, created_at, updated_at FROM projects WHERE id = ?',
        [projectId],
        c.env
      );
      if (rows?.length) {
        project = rows[0];
      }
    } catch (err) {
      console.warn('[Projects] SmartSQL get failed, falling back to buckets:', err);
    }

    if (!project) {
      project = await smartBuckets.get('projects', key, c.env);
    }

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if ((project.user_id || project.userId) !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const parsed = projectUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid input', details: parsed.error.format() }, 400);
    }
    const { name, description } = parsed.data;

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

    // Update SmartSQL primary
    try {
      await smartSQL.execute(
        'UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?',
        [updatedName, updatedDesc, now, projectId],
        c.env
      );
    } catch (err) {
      console.warn('[Projects] SmartSQL update failed, storing in Buckets:', err);
    await smartBuckets.put('projects', key, updatedProject, c.env);
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

app.delete('/api/projects/:projectId', async (c: Context<{ Bindings: AppEnv }>) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const projectId = c.req.param('projectId');
  if (!projectId) {
    return c.json({ error: 'Project ID is required' }, 400);
  }

  try {
    const key = `${userId}/${projectId}`;
    let deleted = false;
    let forbidden = false;

    // Try SmartSQL delete scoped to user
    try {
      const rows = await smartSQL.query(
        'SELECT id, user_id FROM projects WHERE id = ?',
        [projectId],
        c.env
      );
      if (rows?.length) {
        const project = rows[0];
        if ((project.user_id || project.userId) === userId) {
          await smartSQL.execute('DELETE FROM projects WHERE id = ?', [projectId], c.env);
          deleted = true;
        } else {
          forbidden = true;
        }
      }
    } catch (err) {
      console.warn('[Projects] SmartSQL delete path failed, will try buckets:', err);
    }

    // Try Buckets delete (handles legacy/fallback copies)
    try {
      const bucketProject = await smartBuckets.get('projects', key, c.env);
      if (bucketProject && (bucketProject.user_id === userId || bucketProject.userId === userId)) {
        const bucketDeleted = await smartBuckets.delete('projects', key, c.env);
        deleted = deleted || bucketDeleted;
      } else if (bucketProject) {
        forbidden = true;
      }
    } catch (err) {
      console.warn('[Projects] Bucket delete failed:', err);
    }

    // If we still have artifacts under this user/prefix, attempt to clean them up
    if (!deleted) {
      try {
        const keys = await smartBuckets.list('projects', `${userId}/`, c.env);
        for (const k of keys || []) {
          if (k.endsWith(`/${projectId}`)) {
            await smartBuckets.delete('projects', k, c.env);
            deleted = true;
          }
        }
      } catch (err) {
        console.warn('[Projects] Bucket sweep delete failed:', err);
      }
    }

    if (forbidden) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    if (!deleted) {
      return c.json({ error: 'Project not found' }, 404);
    }

    return c.json({ message: 'Project deleted successfully' });
  } catch (error: any) {
    console.error('[Projects] Delete project error:', error?.message || error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// === Ingest Routes ===
app.post('/api/ingest/:projectId', async (c: Context<{ Bindings: AppEnv }>) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const projectIdParam = c.req.param('projectId');
    const body = await c.req.json();
    const parsed = ingestBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid input', details: parsed.error.format() }, 400);
    }
    const { logs: logContent, metadata, projectId: bodyProjectId } = parsed.data;

    const projectId = projectIdParam || bodyProjectId;
    if (!projectId) {
      return c.json({ error: 'Project ID is required' }, 400);
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

app.get('/api/ingest/:projectId', async (c: Context<{ Bindings: AppEnv }>) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const projectId = c.req.param('projectId');
  if (!projectId) {
    return c.json({ error: 'Project ID is required' }, 400);
  }

  try {
    const projectLogs = await ingestRoutes.getLogs(projectId, c.env);
    
    const parsedQuery = ingestQuerySchema.safeParse({
      limit: c.req.query('limit'),
      offset: c.req.query('offset'),
    });
    if (!parsedQuery.success) {
      return c.json({ error: 'Invalid query', details: parsedQuery.error.format() }, 400);
    }
    const { limit = 50, offset = 0 } = parsedQuery.data;
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
app.get('/api/forecast/:projectId', async (c: Context<{ Bindings: AppEnv }>) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const projectId = c.req.param('projectId');
  if (!projectId) {
    return c.json({ error: 'Project ID is required' }, 400);
  }

  try {
    const parsedQuery = forecastQuerySchema.safeParse({
      date: c.req.query('date') || undefined,
    });
    if (!parsedQuery.success) {
      return c.json({ error: 'Invalid query', details: parsedQuery.error.format() }, 400);
    }
    const date = parsedQuery.data.date || new Date().toISOString().split('T')[0];
    const force = c.req.query('force') === '1' || c.req.query('force') === 'true';
    const { generateForecast } = await import('../services/forecastService');
    const { smartBuckets, smartInference } = await import('../services/raindropSmart');

    // Check if forecast exists
    const bucket = 'forecasts';
    const key = `${projectId}/${date}`;
    let forecast = force ? undefined : await smartBuckets.get(bucket, key, c.env);

    if (force || !forecast || shouldRegenerateForecast(forecast)) {
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
          forecast = await generateForecast(projectId, date, c.env);
        }
        
        await smartBuckets.put(bucket, key, forecast, c.env);
      } catch (error: any) {
        console.error('Forecast generation error:', error);
        forecast = await generateForecast(projectId, date, c.env);
        await smartBuckets.put(bucket, key, forecast, c.env);
      }
    }

    return c.json({ forecast });
  } catch (error: any) {
    console.error('Get forecast error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.get('/api/forecast/:projectId/history', async (c: Context<{ Bindings: AppEnv }>) => {
  const userId = await requireAuth(c);
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

app.get('/api/forecast/:projectId/risk-history', async (c: Context<{ Bindings: AppEnv }>) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const projectId = c.req.param('projectId');
  if (!projectId) {
    return c.json({ error: 'Project ID is required' }, 400);
  }

  try {
    const parsedQuery = historyQuerySchema.safeParse({
      limit: c.req.query('limit'),
    });
    if (!parsedQuery.success) {
      return c.json({ error: 'Invalid query', details: parsedQuery.error.format() }, 400);
    }
    const { limit = 30 } = parsedQuery.data;
    const { getRiskHistory } = await import('../routes/ingest');
    let history = await getRiskHistory(projectId, limit, c.env);

    // If still empty, try to include the latest cached risk score
    if (!history || history.length === 0) {
      try {
        const rows = await smartSQL.query(
          'SELECT score, labels, factors, timestamp FROM risk_history WHERE project_id = ? ORDER BY timestamp DESC LIMIT 1',
          [projectId],
          c.env
        );
        if (rows?.length) {
          history = rows.map(row => ({
            score: row.score,
            labels: typeof row.labels === 'string' ? JSON.parse(row.labels) : row.labels || [],
            factors: typeof row.factors === 'string' ? JSON.parse(row.factors) : row.factors || {},
            timestamp: row.timestamp,
          }));
        }
      } catch (err) {
        console.warn('[RiskHistory] Fallback latest fetch failed:', err);
      }
    }

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

    // Create tables using SmartSQL executeQuery with sqlQuery (direct SQL, not textQuery which is natural language!)
    // Wrap each in try-catch to handle existing tables gracefully
    try {
      await db.executeQuery({
        sqlQuery: `CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT,
          created_at TEXT,
          updated_at TEXT
        )`,
        format: 'json'
      });
      
      // Migrate existing table: allow NULL for password_hash (for Stripe/WorkOS users)
      try {
        await db.executeQuery({
          sqlQuery: `ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`,
          format: 'json'
        });
        console.log('[CloudSage] Updated users table to allow NULL password_hash');
      } catch (alterErr: any) {
        // Ignore if column is already nullable or ALTER not supported
        // SQLite doesn't support ALTER COLUMN, so we'll handle this differently
        if (!alterErr.message?.includes('syntax error') && !alterErr.message?.includes('no such column')) {
          console.log('[CloudSage] Could not alter password_hash column (may already be nullable):', alterErr.message);
        }
      }
    } catch (e) {
      console.log('[CloudSage] Users table already exists or error:', e);
    }

    try {
      await db.executeQuery({
        sqlQuery: `CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          created_at TEXT,
          updated_at TEXT
        )`,
        format: 'json'
      });
      // Unique index to prevent duplicate project names per user
      await db.executeQuery({
        sqlQuery: `CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_user_name ON projects(user_id, name)`,
        format: 'json'
      });
    } catch (e) {
      console.log('[CloudSage] Projects table already exists or error:', e);
    }

    try {
      await db.executeQuery({
        sqlQuery: `CREATE TABLE IF NOT EXISTS risk_history (
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
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    try {
      console.log('[Service] fetch called');
      console.log('[Service] env param exists:', !!env);

      // Try to get env from this or parameter
      const actualEnv = env || (this as any).env;
      console.log('[Service] actualEnv exists:', !!actualEnv);

      // Initialize SmartSQL tables once if MAIN_DB is available
      if (actualEnv?.MAIN_DB && !dbInitialized) {
        try {
          // Always run init to ensure schemas + unique index; idempotent via IF NOT EXISTS
          const ok = await initDatabase(actualEnv.MAIN_DB);
          dbInitialized = ok;
          if (ok) globalAny[DB_INIT_FLAG] = true;
        } catch (e) {
          console.warn('[CloudSage] DB init failed, continuing with fallbacks:', e);
        }
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
