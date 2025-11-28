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
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
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
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

export const apiClient = {
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
    } finally {
      removeToken();
    }
  },

  // Projects
  async getProjects() {
    return request<{ projects: Project[] }>('/projects');
  },

  async getProject(id: string) {
    return request<{ project: Project }>(`/projects/${id}`);
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
};

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}
