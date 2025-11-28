// Authentication routes
import { IncomingMessage, ServerResponse } from 'http';
import { parseBody } from '../utils/parseBody';
import { sendSuccess, sendError } from '../utils/response';

// Simple in-memory user store (will be replaced with SmartSQL later)
const users: Map<string, { id: string; email: string; password: string }> = new Map();
let nextUserId = 1;

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

    if (users.has(email)) {
      sendError(res, 400, 'User already exists');
      return;
    }

    const userId = `user_${nextUserId++}`;
    const hashedPassword = hashPassword(password);
    
    users.set(email, {
      id: userId,
      email,
      password: hashedPassword,
    });

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

    const user = users.get(email);
    if (!user) {
      sendError(res, 401, 'Invalid credentials');
      return;
    }

    const hashedPassword = hashPassword(password);
    if (user.password !== hashedPassword) {
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
