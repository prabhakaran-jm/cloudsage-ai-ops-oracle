// Authentication routes
import { IncomingMessage, ServerResponse } from 'http';
import { parseBody } from '../utils/parseBody';
import { sendSuccess, sendError } from '../utils/response';
import { smartSQL } from '../services/raindropSmart';

// Fallback in-memory user store (used if SmartSQL unavailable)
const users: Map<string, { id: string; email: string; password: string }> = new Map();
let nextUserId = 1;

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

// Simple password hashing (for MVP - use bcrypt in production)
function hashPassword(password: string): string {
  // Very basic hash for MVP - replace with proper hashing
  return Buffer.from(password).toString('base64');
}

function generateToken(userId: string): string {
  // Simple token generation for MVP - use JWT in production
  return Buffer.from(`${userId}:${Date.now()}`).toString('base64');
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
    const hashedPassword = hashPassword(password);

    const newUser = {
      id: userId,
      email,
      password: hashedPassword,
    };

    console.log('[Auth] Creating new user:', email);
    await createUserInDB(newUser);

    const token = generateToken(userId);

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
    const hashedPassword = hashPassword(password);
    console.log('[Auth] Stored password hash:', user.password);
    console.log('[Auth] Provided password hash:', hashedPassword);
    console.log('[Auth] Passwords match:', user.password === hashedPassword);
    
    if (user.password !== hashedPassword) {
      console.log('Password mismatch for email:', email);
      sendError(res, 401, 'Invalid credentials');
      return;
    }

    console.log('Login successful for email:', email);
    const token = generateToken(user.id);

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
