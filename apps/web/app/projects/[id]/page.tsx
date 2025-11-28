'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiClient, Project, RiskScore, Forecast, RiskHistoryEntry } from '@/lib/apiClient';
import Link from 'next/link';
import LogIngest from '@/components/LogIngest';
import RiskPanel from '@/components/RiskPanel';
import ForecastPanel from '@/components/ForecastPanel';
import HistoryChart from '@/components/HistoryChart';

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [riskHistory, setRiskHistory] = useState<RiskHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (projectId) {
      loadProject();
      loadForecast();
      loadRiskHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadProject = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getProject(projectId) as { project: Project; riskScore?: RiskScore };
      setProject(data.project);
      setName(data.project.name);
      setDescription(data.project.description || '');
      if (data.riskScore) {
        setRiskScore(data.riskScore);
      }
    } catch (err: any) {
      if (err.message.includes('Unauthorized')) {
        router.push('/login');
      } else {
        setError(err.message || 'Failed to load project');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadForecast = async () => {
    try {
      setForecastLoading(true);
      const data = await apiClient.getForecast(projectId);
      setForecast(data.forecast);
    } catch (err: any) {
      console.error('Failed to load forecast:', err);
      // Don't show error for forecast, it's optional
    } finally {
      setForecastLoading(false);
    }
  };

  const loadRiskHistory = async () => {
    try {
      const data = await apiClient.getRiskHistory(projectId, 30);
      setRiskHistory(data.history);
    } catch (err: any) {
      console.error('Failed to load risk history:', err);
    }
  };

  const handleRefresh = () => {
    loadProject();
    loadForecast();
    loadRiskHistory();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const data = await apiClient.updateProject(projectId, name.trim(), description.trim() || undefined);
      setProject(data.project);
      setEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update project');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      await apiClient.deleteProject(projectId);
      router.push('/projects');
    } catch (err: any) {
      setError(err.message || 'Failed to delete project');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading project...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Project not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/projects" className="text-gray-600 hover:text-gray-900 mr-4">
                ← Back to Projects
              </Link>
              <h1 className="text-xl font-bold text-gray-900">CloudSage</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {editing ? (
            <form onSubmit={handleUpdate} className="bg-white p-6 rounded-lg shadow">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  rows={4}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setName(project.name);
                    setDescription(project.description || '');
                  }}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{project.name}</h2>
                  {project.description && (
                    <p className="text-gray-600 mb-4">{project.description}</p>
                  )}
                  <p className="text-sm text-gray-500">
                    Created: {new Date(project.createdAt).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">
                    Updated: {new Date(project.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>

            </div>
          )}

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <RiskPanel riskScore={riskScore} loading={loading} />
            </div>
            <div>
              <LogIngest projectId={projectId} onIngested={handleRefresh} />
            </div>
          </div>

          <div className="mt-8">
            <ForecastPanel forecast={forecast} loading={forecastLoading} />
          </div>

          <div className="mt-8">
            <HistoryChart history={riskHistory} loading={loading} />
          </div>
        </div>
      </main>
    </div>
  );
}


