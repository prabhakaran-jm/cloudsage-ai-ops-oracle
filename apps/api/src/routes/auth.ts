// Authentication routes
import { IncomingMessage, ServerResponse } from 'http';
import { parseBody } from '../utils/parseBody';
import { sendSuccess, sendError } from '../utils/response';
import { smartSQL } from '../services/raindropSmart';
import { SignJWT, jwtVerify } from 'jose';

// Fallback in-memory user store (used if SmartSQL unavailable)
const users: Map<string, { id: string; email: string; password: string }> = new Map();
let nextUserId = 1;

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-dev-secret';

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return Buffer.from(binary, 'binary').toString('base64');
}

function fromBase64(str: string): Uint8Array {
  const binary = Buffer.from(str, 'base64').toString('binary');
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
  // Edge runtime supports up to ~100k iterations; keep within that limit.
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

async function passwordsMatch(storedHash: string, password: string): Promise<boolean> {
  if (storedHash?.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
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
    return storedHash === Buffer.from(password).toString('base64');
  } catch {
    return false;
  }
}

export async function getUserIdFromAuthHeader(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  // Try JWT first
  try {
    const key = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, key);
    if ((payload as any)?.userId) return (payload as any).userId as string;
  } catch {
    // fall through to legacy
  }
  // Legacy base64 token support
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const userId = decoded.split(':')[0];
    return userId || null;
  } catch {
    return null;
  }
}

// Helper to get user by email (tries SmartSQL first, falls back to memory)
async function getUserByEmail(email: string): Promise<any | null> {
  try {
    const rows = await smartSQL.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    if (rows && rows.length > 0) {
      const user = rows[0];
      console.log('[Auth] User found in SmartSQL:', email);
      console.log('[Auth] User data from DB:', JSON.stringify(user));
      // Normalize field names from snake_case to camelCase
      const normalizedUser = {
        id: user.id,
        email: user.email,
        password: user.password_hash || user.password,
        createdAt: user.created_at || user.createdAt,
        updatedAt: user.updated_at || user.updatedAt,
      };
      console.log('[Auth] Normalized user:', JSON.stringify({ ...normalizedUser, password: '[REDACTED]' }));
      return normalizedUser;
    }
    // User not found in SmartSQL (but SmartSQL is working)
    console.log('[Auth] User not found in SmartSQL:', email);
    return null;
  } catch (error) {
    console.warn('[Auth] SmartSQL query failed, using fallback:', error);
    // Only use fallback if SmartSQL is unavailable (not just "no results")
    const inMemoryUser = users.get(email);
    if (inMemoryUser) {
      console.log('[Auth] User found in fallback storage:', email);
      return inMemoryUser;
    }
  }

  return null;
}

// Helper to create user (tries SmartSQL first, falls back to memory)
async function createUserInDB(user: { id: string; email: string; password: string }): Promise<void> {
  try {
    const result = await smartSQL.execute(
      'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [user.id, user.email, user.password, new Date().toISOString(), new Date().toISOString()]
    );
    // Check if insert actually succeeded
    if (result && result.affectedRows > 0) {
      console.log('[Auth] User created in SmartSQL:', user.email);
      return; // Success, don't use fallback
    }
    // If affectedRows is 0, something went wrong
    console.warn('[Auth] SmartSQL insert returned 0 affected rows, using fallback');
    throw new Error('Insert failed - 0 rows affected');
  } catch (error) {
    console.warn('[Auth] SmartSQL insert failed, using fallback:', error);
    // Fallback to in-memory storage
    users.set(user.email, user);
    console.log('[Auth] User created in fallback storage:', user.email);
  }
}

function generateToken(userId: string): Promise<string> {
  const key = new TextEncoder().encode(JWT_SECRET);
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(key);
}

export async function handleRegister(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req);
    let { email, password } = body;

    if (!email || !password) {
      sendError(res, 400, 'Email and password are required');
      return;
    }

    // Normalize email
    email = email.toLowerCase().trim();

    console.log('[Auth] Registration attempt for email:', email);

    // Check if user already exists
    try {
      const existingUser = await getUserByEmail(email);
      if (existingUser) {
        console.log('[Auth] User already exists:', email);
        sendError(res, 400, 'User already exists');
        return;
      }
    } catch (error) {
      console.error('[Auth] Error checking existing user:', error);
      // Continue with registration even if check fails
    }

    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const hashedPassword = await hashPassword(password);

    const newUser = {
      id: userId,
      email,
      password: hashedPassword,
    };

    console.log('[Auth] Creating new user:', email);
    await createUserInDB(newUser);

    const token = await generateToken(userId);

    console.log('[Auth] Registration successful for email:', email);
    sendSuccess(res, {
      token,
      user: {
        id: userId,
        email,
      },
    });
  } catch (error: any) {
    console.error('[Auth] Registration error:', error?.message || error);
    sendError(res, 500, 'Internal server error');
  }
}

export async function handleLogin(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req);
    let { email, password } = body;

    if (!email || !password) {
      sendError(res, 400, 'Email and password are required');
      return;
    }

    // Normalize email
    email = email.toLowerCase().trim();

    console.log('Login attempt for email:', email);
    const user = await getUserByEmail(email);
    
    if (!user) {
      console.log('User not found for email:', email);
      sendError(res, 401, 'Invalid credentials');
      return;
    }

    console.log('User found, checking password...');
    const hashedPassword = user.password;
    const match = hashedPassword ? await passwordsMatch(hashedPassword, password) : false;
    console.log('[Auth] Stored password hash length:', hashedPassword?.length);
    console.log('[Auth] Passwords match:', match);
    
    if (!match) {
      console.log('Password mismatch for email:', email);
      sendError(res, 401, 'Invalid credentials');
      return;
    }

    console.log('Login successful for email:', email);
    const token = await generateToken(user.id);

    sendSuccess(res, {
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    sendError(res, 500, 'Internal server error');
  }
}

export function handleLogout(req: IncomingMessage, res: ServerResponse) {
  // For MVP, logout is handled client-side by removing token
  sendSuccess(res, { message: 'Logged out successfully' });
}
