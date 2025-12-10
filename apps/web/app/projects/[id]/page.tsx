'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiClient, Project, RiskScore, Forecast, RiskHistoryEntry } from '@/lib/apiClient';
import Link from 'next/link';
import LogIngest from '@/components/LogIngest';
import RiskPanel from '@/components/RiskPanel';
import ForecastPanel from '@/components/ForecastPanel';
import HistoryChart from '@/components/HistoryChart';

// Mock action items for demo
const mockActionItems = [
  { id: 1, text: 'Scale up web-worker-3 deployment.', completed: true, time: '2h ago', priority: 'high' },
  { id: 2, text: 'Investigate high I/O wait on primary database.', completed: false, time: '4h ago', priority: 'medium' },
  { id: 3, text: 'Review latest security patch for Redis cache.', completed: false, time: '1d ago', priority: 'medium' }
];

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null);
  const [riskScoreTimestamp, setRiskScoreTimestamp] = useState<string | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [riskHistory, setRiskHistory] = useState<RiskHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [apiStatus, setApiStatus] = useState<'ok' | 'degraded' | 'down'>('degraded');
  const [workerStatus, setWorkerStatus] = useState<'ok' | 'degraded' | 'down'>('degraded');

  useEffect(() => {
    if (projectId) {
      loadProject();
      loadForecast();
      loadRiskHistory();
      checkHealth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadProject = async () => {
    try {
      setLoading(true);
      console.log('[ProjectDetail] Loading project:', projectId);
      const data = await apiClient.getProject(projectId) as { project: Project; riskScore?: RiskScore };
      console.log('[ProjectDetail] Received data:', data);
      console.log('[ProjectDetail] Risk score from API:', data.riskScore);
      setProject(data.project);
      setName(data.project.name);
      setDescription(data.project.description || '');
      if (data.riskScore) {
        // Only update if this risk score is newer than the current one (prevent race condition)
        if (!riskScoreTimestamp || new Date(data.riskScore.timestamp) >= new Date(riskScoreTimestamp)) {
          console.log('[ProjectDetail] Setting risk score from project load:', data.riskScore);
          setRiskScore(data.riskScore);
          setRiskScoreTimestamp(data.riskScore.timestamp);
        } else {
          console.log('[ProjectDetail] Ignoring stale risk score from project load. Current:', riskScoreTimestamp, 'Received:', data.riskScore.timestamp);
        }
      } else {
        console.log('[ProjectDetail] No risk score in response');
      }
    } catch (err: any) {
      console.error('[ProjectDetail] Error loading project:', err);
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
      setForecastError('');
      const data = await apiClient.getForecast(projectId);
      setForecast(data.forecast);
    } catch (err: any) {
      console.error('Failed to load forecast:', err);
      setForecastError(err.message || 'Failed to load forecast');
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

  const handleRefresh = (newRiskScore?: RiskScore) => {
    console.log('[ProjectDetail] Refresh triggered after log ingestion');

    if (newRiskScore) {
      console.log('[ProjectDetail] Using immediate risk score from ingestion response:', newRiskScore);
      setRiskScore(newRiskScore);
      setRiskScoreTimestamp(newRiskScore.timestamp);
    } else {
      // Only reload project (to get risk score) if we didn't get it directly
      loadProject();
    }

    loadForecast();
    loadRiskHistory();
  };

  const checkHealth = async () => {
    try {
      const api = await apiClient.getApiHealth();
      setApiStatus(api.status === 'ok' ? 'ok' : 'degraded');
    } catch {
      setApiStatus('down');
    }
    try {
      await apiClient.getWorkerHealth(process.env.NEXT_PUBLIC_WORKER_HEALTH_URL);
      setWorkerStatus('ok');
    } catch {
      setWorkerStatus('degraded');
    }
  };

  const badgeClass = (status: string) => {
    if (status === 'ok') return 'bg-green-500/20 text-green-200 border-green-500/40';
    if (status === 'degraded') return 'bg-amber-500/20 text-amber-200 border-amber-500/40';
    return 'bg-red-500/20 text-red-200 border-red-500/40';
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
      <div className="min-h-screen bg-[#121121] flex items-center justify-center">
        <div className="text-white/70">Loading project...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#121121] flex items-center justify-center">
        <div className="text-white/70">Project not found</div>
      </div>
    );
  }

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden bg-[#121121] text-white">
      {/* Background Gradient */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[#121121]"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[80vh] bg-[#5048e5]/20 rounded-full blur-[200px]"></div>
      </div>

      <div className="relative z-10 layout-container flex h-full grow flex-col">
        <div className="flex flex-1 justify-center px-4 py-8 sm:px-8 md:px-12 lg:px-20">
          <div className="layout-content-container flex w-full max-w-4xl flex-col gap-8">
            {/* Header */}
            <header>
              <div className="mb-2">
                <div className="flex flex-wrap gap-2">
                  <Link href="/projects" className="text-[#9795c6] hover:text-white transition-colors text-base font-medium leading-normal">
                    Projects
                  </Link>
                  <span className="text-[#9795c6] text-base font-medium leading-normal">/</span>
                  <span className="text-white text-base font-medium leading-normal">{project.name}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                {editing ? (
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-white text-4xl font-bold leading-tight tracking-tight bg-transparent border-b border-white/20 focus:border-[#5048e5] focus:outline-none"
                  />
                ) : (
                  <h1 className="text-white text-4xl font-bold leading-tight tracking-tight">{project.name}</h1>
                )}
                <div className="flex flex-1 gap-3 flex-wrap justify-start sm:justify-end min-w-[200px]">
                  {editing ? (
                    <>
                      <button
                        onClick={handleUpdate}
                        className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-4 bg-[#5048e5] hover:bg-[#5048e5]/90 text-white text-sm font-bold leading-normal tracking-[0.015em] transition-colors"
                      >
                        <span className="truncate">Save</span>
                      </button>
                      <button
                        onClick={() => {
                          setEditing(false);
                          setName(project.name);
                          setDescription(project.description || '');
                        }}
                        className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-4 bg-white/10 hover:bg-white/20 text-white text-sm font-bold leading-normal tracking-[0.015em] transition-colors"
                      >
                        <span className="truncate">Cancel</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditing(true)}
                        className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-4 bg-white/10 hover:bg-white/20 text-white text-sm font-bold leading-normal tracking-[0.015em] transition-colors"
                      >
                        <span className="text-base">✏</span>
                        <span className="truncate">Edit</span>
                      </button>
                      <button
                        onClick={handleDelete}
                        className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-4 bg-white/10 hover:bg-white/20 text-white text-sm font-bold leading-normal tracking-[0.015em] transition-colors"
                      >
                        <span className="text-base">🗑</span>
                        <span className="truncate">Delete</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
              {editing && (
                <div className="mt-4">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-[#5048e5] focus:border-transparent"
                    placeholder="Project description..."
                    rows={3}
                  />
                </div>
              )}
            </header>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
            <div className="flex flex-wrap gap-3 text-xs">
              <span className={`px-3 py-1 rounded-full border ${badgeClass(apiStatus)}`}>
                API: {apiStatus.toUpperCase()}
              </span>
              <span className={`px-3 py-1 rounded-full border ${badgeClass(workerStatus)}`}>
                Worker: {workerStatus.toUpperCase()}
              </span>
              {riskScoreTimestamp && (
                <span className="px-3 py-1 rounded-full border border-white/10 text-white/60">
                  Risk updated: {new Date(riskScoreTimestamp).toLocaleString()}
                </span>
              )}
              {forecast?.generatedAt && (
                <span className="px-3 py-1 rounded-full border border-white/10 text-white/60">
                  Forecast updated: {new Date(forecast.generatedAt).toLocaleString()}
                </span>
              )}
            </div>

            {/* Main Content Grid */}
            <main className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {/* Risk Dashboard */}
              <div className="md:col-span-3 rounded-lg p-6 bg-white/5 backdrop-blur-lg border border-white/10">
                <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] mb-6">Risk Dashboard</h2>
                <RiskPanel riskScore={riskScore} loading={loading} updatedAt={riskScoreTimestamp} />
              </div>

              {/* AI Forecast */}
              <div className="md:col-span-3">
                <ForecastPanel forecast={forecast} loading={forecastLoading} error={forecastError} />
              </div>

              {/* Action Items */}
              <div className="md:col-span-2 rounded-lg p-6 bg-white/5 backdrop-blur-lg border border-white/10">
                <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] mb-4">Action Items</h2>
                <div className="space-y-4">
                  {mockActionItems.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-4 rounded-lg border-l-4 ${
                        item.priority === 'high' ? 'border-[#5048e5]' : 'border-amber-500'
                      } bg-white/5 p-4`}
                    >
                      <input
                        checked={item.completed}
                        className="h-5 w-5 rounded border-gray-600 bg-transparent text-[#5048e5] focus:ring-[#5048e5] focus:ring-offset-transparent"
                        type="checkbox"
                        readOnly
                      />
                      <label className="flex-1 text-white/90">{item.text}</label>
                      <span className="text-sm text-[#9795c6]">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Historical Trends */}
              <div className="md:col-span-1 rounded-lg p-6 bg-white/5 backdrop-blur-lg border border-white/10 flex flex-col">
                <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] mb-4">Historical Trends</h2>
                <div className="flex-grow">
                  <HistoryChart history={riskHistory} loading={loading} />
                </div>
              </div>

              {/* Log Ingestion */}
              <div className="md:col-span-3 rounded-lg p-6 bg-white/5 backdrop-blur-lg border border-white/10">
                <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] mb-4">Log Ingestion</h2>
                <LogIngest projectId={projectId} onIngested={handleRefresh} />
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}


