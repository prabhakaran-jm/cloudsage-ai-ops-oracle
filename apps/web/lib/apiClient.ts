// API client for communicating with the backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Get auth token from localStorage
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

// Set auth token in localStorage
function setToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('auth_token', token);
}

// Remove auth token
function removeToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_token');
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    const errorObj = new Error(error.error || error.message || 'Request failed');
    // Preserve error code for passwordless account detection
    if (error.code) {
      (errorObj as any).code = error.code;
    }
    if (error.message) {
      errorObj.message = error.message;
    }
    throw errorObj;
  }

  return response.json();
}

export const apiClient = {
  // Health
  async getApiHealth() {
    return request<{ status: string; timestamp?: string }>('/health');
  },
  async getWorkerHealth(urlOverride?: string) {
    const workerUrl = urlOverride || process.env.NEXT_PUBLIC_WORKER_HEALTH_URL;
    if (!workerUrl) {
      throw new Error('Worker health URL not configured');
    }
    const res = await fetch(workerUrl);
    if (!res.ok) throw new Error(`Worker health failed: ${res.status}`);
    return res.json();
  },

  // Vultr Infrastructure Status
  async getVultrStatus() {
    return request<{
      status: 'online' | 'offline';
      service: string;
      component: string;
      latency?: string | null;
      latencyMs?: number | null;
      region?: string;
      timestamp: string;
      checkedAt?: string;
    }>('/vultr/status');
  },

  // Auth
  async register(email: string, password: string) {
    const data = await request<{ token: string; user: { id: string; email: string } }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );
    setToken(data.token);
    return data;
  },

  async login(email: string, password: string) {
    const data = await request<{ token: string; user: { id: string; email: string } }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );
    setToken(data.token);
    return data;
  },

  async logout() {
    try {
      await request('/auth/logout', { method: 'POST' });
      // Also clear WorkOS session by calling signout endpoint
      // Use a relative URL and handle redirects properly
      try {
        await fetch('/api/auth/signout', { 
          method: 'GET',
          redirect: 'manual', // Don't follow redirects to avoid CORS issues
          credentials: 'include', // Include cookies
        });
      } catch (err) {
        // Ignore errors - WorkOS may not be configured or CORS issues
        // The cookie will be cleared on the next sign-in attempt anyway
        console.warn('WorkOS signout failed (non-critical):', err);
      }
    } finally {
      removeToken();
    }
  },

  // Projects
  async getProjects() {
    return request<{ projects: Project[] }>('/projects');
  },

  async getProject(id: string) {
    return request<{ project: Project; riskScore?: RiskScore }>(`/projects/${id}`);
  },

  async createProject(name: string, description?: string) {
    return request<{ project: Project }>('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  },

  async updateProject(id: string, name?: string, description?: string) {
    return request<{ project: Project }>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, description }),
    });
  },

  async deleteProject(id: string) {
    return request<{ message: string }>(`/projects/${id}`, {
      method: 'DELETE',
    });
  },

  // Log ingestion
  async ingestLogs(projectId: string, logs: string | string[], metadata?: any) {
    return request<{ message: string; count: number; projectId: string; timestamp: string; riskScore?: RiskScore }>(
      `/ingest/${projectId}`,
      {
        method: 'POST',
        body: JSON.stringify({ projectId, logs, metadata }),
      }
    );
  },

  async getLogs(projectId: string, limit = 50, offset = 0) {
    return request<{ logs: LogEntry[]; total: number; limit: number; offset: number }>(
      `/ingest/${projectId}?limit=${limit}&offset=${offset}`
    );
  },

  // Forecasts
  async getForecast(projectId: string, date?: string, force?: boolean) {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (force) params.set('force', '1');
    const qs = params.toString();
    const url = qs ? `/forecast/${projectId}?${qs}` : `/forecast/${projectId}`;
    return request<{ forecast: Forecast }>(url);
  },

  async getForecastHistory(projectId: string) {
    return request<{ forecasts: Forecast[] }>(`/forecast/${projectId}/history`);
  },

  async getRiskHistory(projectId: string, limit = 30) {
    return request<{ history: RiskHistoryEntry[] }>(
      `/forecast/${projectId}/risk-history?limit=${limit}`
    );
  },
};

export interface Forecast {
  id: string;
  projectId: string;
  date: string;
  forecastText: string;
  actions: string[];
  riskScore: number;
  confidence: number;
  generatedAt: string;
  chainSteps?: string[]; // SmartInference chain execution steps
  aiReasoning?: {
    inputSignals: string[];
    analysisSteps: string[];
    modelUsed: string;
    dataPointsAnalyzed: number;
  };
}

export interface RiskHistoryEntry {
  score: number;
  timestamp: string;
  labels: string[];
}

export interface LogEntry {
  id: string;
  projectId: string;
  content: string;
  timestamp: string;
  metadata?: any;
}

export interface RiskScore {
  score: number;
  labels: string[];
  timestamp: string;
  factors: {
    errorRate?: number;
    logVolume?: number;
    latency?: number;
  };
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}
