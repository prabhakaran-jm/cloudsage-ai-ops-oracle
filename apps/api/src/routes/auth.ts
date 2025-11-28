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
    if (rows.length > 0) {
      return rows[0];
    }
  } catch (error) {
    console.warn('SmartSQL query failed, using fallback:', error);
  }
  
  // Fallback to in-memory storage
  return users.get(email) || null;
}

// Helper to create user (tries SmartSQL first, falls back to memory)
async function createUserInDB(user: { id: string; email: string; password: string }): Promise<void> {
  try {
    await smartSQL.execute(
      'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [user.id, user.email, user.password, new Date().toISOString(), new Date().toISOString()]
    );
    return; // Success, don't use fallback
  } catch (error) {
    console.warn('SmartSQL insert failed, using fallback:', error);
  }
  
  // Fallback to in-memory storage
  users.set(user.email, user);
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
    const { email, password } = body;

    if (!email || !password) {
      sendError(res, 400, 'Email and password are required');
      return;
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      sendError(res, 400, 'User already exists');
      return;
    }

    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const hashedPassword = hashPassword(password);
    
    const newUser = {
      id: userId,
      email,
      password: hashedPassword,
    };
    
    await createUserInDB(newUser);

    const token = generateToken(userId);

    sendSuccess(res, {
      token,
      user: {
        id: userId,
        email,
      },
    });
  } catch (error) {
    sendError(res, 500, 'Internal server error');
  }
}

export async function handleLogin(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req);
    const { email, password } = body;

    if (!email || !password) {
      sendError(res, 400, 'Email and password are required');
      return;
    }

    const user = await getUserByEmail(email);
    if (!user) {
      sendError(res, 401, 'Invalid credentials');
      return;
    }
    
    // Handle password_hash field from SmartSQL
    const userPassword = user.password_hash || user.password;

    const hashedPassword = hashPassword(password);
    if (userPassword !== hashedPassword) {
      sendError(res, 401, 'Invalid credentials');
      return;
    }

    const token = generateToken(user.id);

    sendSuccess(res, {
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    sendError(res, 500, 'Internal server error');
  }
}

export function handleLogout(req: IncomingMessage, res: ServerResponse) {
  // For MVP, logout is handled client-side by removing token
  sendSuccess(res, { message: 'Logged out successfully' });
}
