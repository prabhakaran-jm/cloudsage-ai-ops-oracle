import { describe, it, expect } from 'vitest';
import { calculateRiskScore } from '../services/riskLogic';
import { friendlyError } from '../utils/errorMessages';
import { ensureProjectAccess } from '../api/index';

describe('riskLogic.calculateRiskScore', () => {
  it('returns higher score for error-heavy logs', () => {
    const logs = [
      { content: 'ERROR: database connection failed', timestamp: new Date().toISOString() },
      { content: 'timeout while calling upstream service', timestamp: new Date().toISOString() },
      { content: 'exception thrown in worker', timestamp: new Date().toISOString() },
    ];
    const result = calculateRiskScore(logs as any);
    expect(result.score).toBeGreaterThan(30);
    expect(result.labels).toContain('High Error Rate');
  });

  it('returns healthy score for empty logs', () => {
    const result = calculateRiskScore([]);
    expect(result.score).toBe(0);
    expect(result.labels).not.toContain('Critical');
  });
});

describe('friendlyError', () => {
  it('maps SQL constraint to friendly message', () => {
    const msg = friendlyError('UNIQUE constraint failed: projects.user_id, projects.name');
    expect(msg).toMatch(/project with this name/i);
  });

  it('falls back to generic for unknown errors', () => {
    const msg = friendlyError('Some unexpected issue');
    expect(msg).toMatch(/Something went wrong/i);
  });
});

describe('ensureProjectAccess', () => {
  it('returns 400 when projectId missing', async () => {
    // Minimal mock context with json() helper
    const responses: any[] = [];
    const mockContext: any = {
      req: { param: () => undefined },
      json: (body: any, status = 200) => {
        responses.push({ body, status });
        return { body, status } as any;
      },
      env: {},
    };
    const result = await ensureProjectAccess(mockContext, 'user-1', undefined);
    expect(result.ok).toBe(false);
    expect(responses[0].status).toBe(400);
  });
});
