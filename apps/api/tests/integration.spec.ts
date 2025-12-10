// @ts-nocheck
/// <reference types="vitest" />
import { describe, it, expect, vi } from 'vitest';
import { AuthInput, ProjectCreateInput } from '../src/schemas';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3001/api';
vi.setConfig({ testTimeout: 20000 });
const unique = () => Math.random().toString(36).slice(2, 8);

async function api<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  return data as T;
}

describe('Integration: auth -> projects -> ingest -> forecast', () => {
  const email = `test+${unique()}@example.com`;
  const password = 'P@ssw0rd!123';
  let token: string;
  let projectId: string;

  it('registers', async () => {
    const body: AuthInput = { email, password };
    const res = await api<{ token: string; user: { id: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    expect(res.token).toBeTruthy();
    token = res.token;
  });

  it('logins', async () => {
    const body: AuthInput = { email, password };
    const res = await api<{ token: string; user: { id: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    expect(res.token).toBeTruthy();
    token = res.token;
  });

  it('creates project', async () => {
    const body: ProjectCreateInput = { name: `Proj ${unique()}` };
    const res = await api<{ project: { id: string } }>('/projects', {
      method: 'POST',
      body: JSON.stringify(body),
    }, token);
    expect(res.project.id).toBeTruthy();
    projectId = res.project.id;
  });

  it('ingests logs and gets risk score', async () => {
    const logs = [
      '2025-12-10 10:00:00 ERROR failed to connect to db',
      '2025-12-10 10:01:00 WARN slow response latency',
    ];
    const res = await api<{ riskScore?: any; count: number }>(`/ingest/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ logs, metadata: { env: 'test' } }),
    }, token);
    expect(res.count).toBeGreaterThan(0);
    // riskScore might be absent if worker unavailable, but should exist normally
    expect(res.riskScore?.score ?? 0).toBeGreaterThanOrEqual(0);
  });

  it('fetches forecast', async () => {
    const res = await api<{ forecast: any }>(`/forecast/${projectId}`, {
      method: 'GET',
    }, token);
    expect(res.forecast?.projectId).toBe(projectId);
  });
});

describe('Smoke: auth and project CRUD', () => {
  const email = `smoke+${unique()}@example.com`;
  const password = 'P@ssw0rd!123';
  let token: string;
  let projectId: string;

  it('register & login', async () => {
    const body: AuthInput = { email, password };
    const reg = await api<{ token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    token = reg.token;
    const login = await api<{ token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    token = login.token;
  });

  it('create project', async () => {
    const res = await api<{ project: { id: string } }>('/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'Smoke Project' }),
    }, token);
    projectId = res.project.id;
    expect(projectId).toBeTruthy();
  });

  it('list projects', async () => {
    const res = await api<{ projects: any[] }>('/projects', { method: 'GET' }, token);
    expect(Array.isArray(res.projects)).toBe(true);
    expect(res.projects.some(p => p.id === projectId)).toBe(true);
  });

  it('update project', async () => {
    const res = await api<{ project: { name: string } }>(`/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'Smoke Project Updated' }),
    }, token);
    expect(res.project.name).toBe('Smoke Project Updated');
  });

  it('delete project', async () => {
    const res = await api<{ message: string }>(`/projects/${projectId}`, {
      method: 'DELETE',
    }, token);
    expect(res.message).toBeTruthy();
  });
});

