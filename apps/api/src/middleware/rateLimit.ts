import type { Context, Next } from 'hono';

// Simple in-memory rate limiter; per-user-per-path.
const limits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(max: number, windowMs: number) {
  return async (c: Context, next: Next) => {
    const userId = c.get('userId') || 'anonymous';
    const key = `${userId}:${c.req.path}`;
    const now = Date.now();

    const entry = limits.get(key);
    if (entry && entry.resetAt > now) {
      if (entry.count >= max) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return c.json(
          { error: 'Rate limit exceeded. Please try again shortly.', retryAfter },
          429
        );
      }
      entry.count += 1;
      limits.set(key, entry);
    } else {
      limits.set(key, { count: 1, resetAt: now + windowMs });
    }

    await next();
  };
}
