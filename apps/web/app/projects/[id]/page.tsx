'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiClient, Project, RiskScore, Forecast, RiskHistoryEntry } from '@/lib/apiClient';
import Link from 'next/link';
import LogIngest from '@/components/LogIngest';
import RiskPanel from '@/components/RiskPanel';
import ForecastPanel from '@/components/ForecastPanel';
import HistoryChart from '@/components/HistoryChart';
import PlatformBadges from '@/components/PlatformBadges';

// Generate dynamic action items based on risk analysis
function generateActionItems(riskScore: RiskScore | null, riskHistory: RiskHistoryEntry[]) {
  if (!riskScore) {
    return [
      { id: 1, text: 'Ingest logs to generate risk analysis.', completed: false, time: 'now', priority: 'high' }
    ];
  }

  const items: Array<{ id: number; text: string; completed: boolean; time: string; priority: string }> = [];
  let id = 1;
  const labels = riskScore.labels || [];
  const factors = riskScore.factors || {};

  // High priority items based on labels
  if (labels.includes('Critical')) {
    items.push({ id: id++, text: 'URGENT: Address critical system issues immediately.', completed: false, time: 'now', priority: 'critical' });
  }
  if (labels.includes('High Error Rate')) {
    const errorRate = typeof factors.errorRate === 'number' ? Math.round(factors.errorRate) : factors.errorRate || 'high';
    items.push({ id: id++, text: `Investigate error rate (${errorRate}%) - check application logs.`, completed: false, time: 'now', priority: 'high' });
  }
  if (labels.includes('Latency Issues')) {
    const latency = typeof factors.latency === 'number' ? Math.round(factors.latency) : factors.latency || 'elevated';
    items.push({ id: id++, text: `Address latency issues (${latency}%) - review slow queries.`, completed: false, time: 'now', priority: 'high' });
  }
  if (labels.includes('Resource Exhaustion')) {
    items.push({ id: id++, text: 'Scale up resources or optimize memory usage.', completed: false, time: 'now', priority: 'high' });
  }

  // Medium priority based on score trends
  if (riskHistory.length >= 2) {
    const recent = riskHistory[0]?.score || 0;
    const previous = riskHistory[1]?.score || 0;
    if (recent > previous) {
      items.push({ id: id++, text: 'Risk score increasing - review recent deployments.', completed: false, time: '1h ago', priority: 'medium' });
    } else if (recent < previous) {
      items.push({ id: id++, text: 'Risk score improving - continue monitoring.', completed: true, time: '1h ago', priority: 'low' });
    }
  }

  // General recommendations based on score level
  if (riskScore.score >= 70) {
    items.push({ id: id++, text: 'Enable enhanced monitoring and alerting.', completed: false, time: '2h ago', priority: 'medium' });
  } else if (riskScore.score >= 40) {
    items.push({ id: id++, text: 'Schedule routine system health review.', completed: false, time: '4h ago', priority: 'low' });
  } else {
    items.push({ id: id++, text: 'System healthy - maintain current practices.', completed: true, time: '1d ago', priority: 'low' });
  }

  return items.slice(0, 5); // Limit to 5 items
}

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
  const [historyLoading, setHistoryLoading] = useState(false);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [apiStatus, setApiStatus] = useState<'ok' | 'degraded' | 'down'>('degraded');
  const [workerStatus, setWorkerStatus] = useState<'ok' | 'degraded' | 'down'>('degraded');
  const [vultrStatus, setVultrStatus] = useState<{ status: string; latency?: string | null; checkedAt?: string | null }>({ status: 'checking' });

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

  const loadForecast = async (force?: boolean) => {
    try {
      setForecastLoading(true);
      setForecastError('');
      const data = await apiClient.getForecast(projectId, undefined, force);
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
      setHistoryLoading(true);
      const data = await apiClient.getRiskHistory(projectId, 30);
      setRiskHistory(data.history);
      return data.history;
    } catch (err: any) {
      console.error('Failed to load risk history:', err);
      return [];
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRefresh = async (newRiskScore?: RiskScore) => {
    console.log('[ProjectDetail] Refresh triggered after log ingestion');

    if (newRiskScore) {
      console.log('[ProjectDetail] Using immediate risk score from ingestion response:', newRiskScore);
      setRiskScore(newRiskScore);
      setRiskScoreTimestamp(newRiskScore.timestamp);
      // Optimistically append to history, but then refresh from API to avoid races
      setRiskHistory((prev) => {
        const next = [
          { score: newRiskScore.score, timestamp: newRiskScore.timestamp, labels: newRiskScore.labels || [] },
          ...prev,
        ];
        return next.slice(0, 30);
      });
    } else {
      // Only reload project (to get risk score) if we didn't get it directly
      loadProject();
    }

    // Always refresh forecast (force regenerate) and history to reflect latest context
    const [history] = await Promise.all([loadRiskHistory(), loadForecast(true)]);

    // Ensure optimistic entry remains if API response did not yet include it
    if (newRiskScore && !history.some((h) => h.timestamp === newRiskScore.timestamp)) {
      setRiskHistory((prev) => {
        const next = [
          { score: newRiskScore.score, timestamp: newRiskScore.timestamp, labels: newRiskScore.labels || [] },
          ...prev,
        ];
        return next.slice(0, 30);
      });
    }
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
    // Check Vultr infrastructure status
    try {
      const vultr = await apiClient.getVultrStatus();
      setVultrStatus({ status: vultr.status, latency: vultr.latency, checkedAt: vultr.checkedAt || vultr.timestamp });
    } catch {
      setVultrStatus({ status: 'offline', latency: null, checkedAt: null });
    }
  };

  const badgeClass = (status: string) => {
    if (status === 'ok') return 'bg-green-500/20 text-green-200 border-green-500/40';
    if (status === 'degraded') return 'bg-amber-500/20 text-amber-200 border-amber-500/40';
    return 'bg-red-500/20 text-red-200 border-red-500/40';
  };

  // Simulate AI-powered auto-remediation

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

  // Sample logs for demo purposes
  const handleLoadSampleLogs = async () => {
    const SAMPLE_LOGS = `[2024-12-11 10:15:32] ERROR: Database connection timeout after 30s - primary-db.prod
[2024-12-11 10:15:33] WARN: Retry attempt 1/3 for database connection
[2024-12-11 10:15:35] ERROR: API endpoint /api/users returned 500 - request_id: abc123
[2024-12-11 10:15:36] WARN: Memory usage at 85% on worker-node-3
[2024-12-11 10:15:38] ERROR: Failed to process payment for order #12345 - Stripe timeout
[2024-12-11 10:15:40] INFO: Auto-scaling triggered - adding 2 new instances
[2024-12-11 10:15:42] WARN: Response time for /api/projects exceeded 2s threshold
[2024-12-11 10:15:45] ERROR: Redis connection lost - Attempting reconnect
[2024-12-11 10:15:47] WARN: CPU usage spike to 92% on api-server-1
[2024-12-11 10:15:50] ERROR: Authentication service unavailable - fallback to cache`;

    try {
      setLoading(true);
      const result = await apiClient.ingestLogs(projectId, SAMPLE_LOGS);
      console.log('[ProjectDetail] Sample logs ingested:', result);
      if (result.riskScore) {
        await handleRefresh(result.riskScore);
      } else {
        await handleRefresh();
      }
      // Scroll to log ingestion section
      setTimeout(() => {
        const logSection = document.getElementById('log-ingestion');
        if (logSection) {
          logSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (err: any) {
      console.error('Failed to load sample logs:', err);
      setError(err.message || 'Failed to load sample logs');
    } finally {
      setLoading(false);
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

            {/* Infrastructure Status Panel */}
            <div className="flex flex-wrap items-center gap-4 p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full border text-xs ${badgeClass(apiStatus)}`}>
                  Raindrop API: {apiStatus.toUpperCase()}
                </span>
              </div>
              
              {/* Vultr Status - Prominent */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#007BFC]/10 border border-[#007BFC]/30">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#007BFC" strokeWidth="2" fill="none"/>
                </svg>
                <span className="text-[#007BFC] font-medium text-xs">Vultr</span>
                <span className={`flex items-center gap-1 text-xs ${
                  vultrStatus.status === 'online' ? 'text-green-400' : 
                  vultrStatus.status === 'checking' ? 'text-amber-400' : 'text-red-400'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    vultrStatus.status === 'online' ? 'bg-green-400 animate-pulse' : 
                    vultrStatus.status === 'checking' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'
                  }`} />
                  {vultrStatus.status === 'online' ? 'Risk Engine Online' : 
                   vultrStatus.status === 'checking' ? 'Connecting...' : 'Offline (using fallback)'}
                </span>
                {riskScore?.latencyMs ? (
                  <span className="text-white/40 text-xs">({riskScore.latencyMs}ms)</span>
                ) : vultrStatus.latency ? (
                  <span className="text-white/40 text-xs">({vultrStatus.latency})</span>
                ) : null}
              </div>

              {riskScoreTimestamp && (
                <span className="px-3 py-1 rounded-full border border-white/10 text-white/60 text-xs">
                  Risk: {new Date(riskScoreTimestamp).toLocaleString()}
                </span>
              )}
              {forecast?.generatedAt && (
                <span className="px-3 py-1 rounded-full border border-white/10 text-white/60 text-xs">
                  Forecast: {new Date(forecast.generatedAt).toLocaleString()}
                </span>
              )}
            </div>

            {/* Vultr Cloud Compute status widget */}
            <div className="rounded-lg p-4 bg-[#007BFC]/5 border border-[#007BFC]/20 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#007BFC]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#007BFC" strokeWidth="2" fill="none"/>
                  </svg>
                  <div>
                    <div className="text-sm font-semibold text-white">Vultr Cloud Compute</div>
                    <div className="text-xs text-white/60">Risk scoring engine</div>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  vultrStatus.status === 'online' ? 'bg-green-500/20 text-green-200 border border-green-500/30' :
                  vultrStatus.status === 'checking' ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30' :
                  'bg-red-500/20 text-red-200 border border-red-500/30'
                }`}>
                  {vultrStatus.status === 'online' ? 'Online' : vultrStatus.status === 'checking' ? 'Connecting' : 'Offline'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-white/80">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                  <span>Health check:</span>
                  <span className="font-semibold">{vultrStatus.latency || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
                  <span>Risk scoring:</span>
                  <span className="font-semibold">{riskScore?.latencyMs ? `${riskScore.latencyMs}ms` : '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                  <span>Last risk calc:</span>
                  <span className="font-semibold">{riskScoreTimestamp ? new Date(riskScoreTimestamp).toLocaleTimeString() : '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                  <span>Last checked:</span>
                  <span className="font-semibold">{vultrStatus.checkedAt ? new Date(vultrStatus.checkedAt).toLocaleTimeString() : '—'}</span>
                </div>
              </div>
              <div className="text-[11px] text-white/50">
                Powered by Vultr Cloud Compute • Handles 10K+ logs/s • Raindrop SmartInference for forecasts
              </div>
            </div>

            {/* Main Content Grid */}
            <main className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {/* Risk Dashboard */}
              <div className="md:col-span-3 rounded-lg p-6 bg-white/5 backdrop-blur-lg border border-white/10">
                <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] mb-6">Risk Dashboard</h2>
                <RiskPanel 
                  riskScore={riskScore} 
                  loading={loading} 
                  updatedAt={riskScoreTimestamp} 
                  onLoadSampleLogs={handleLoadSampleLogs}
                />
              </div>

              {/* AI Forecast */}
              <div className="md:col-span-3">
                <ForecastPanel 
                  forecast={forecast} 
                  loading={forecastLoading} 
                  error={forecastError} 
                  onRefresh={() => loadForecast(true)}
                />
              </div>

              {/* Action Items */}
              <div className="md:col-span-2 rounded-lg p-6 bg-white/5 backdrop-blur-lg border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">Action Items</h2>
                </div>

                <div className="space-y-4">
                  {generateActionItems(riskScore, riskHistory).map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-4 rounded-lg border-l-4 ${
                        item.priority === 'critical' ? 'border-red-500' :
                        item.priority === 'high' ? 'border-[#5048e5]' :
                        item.priority === 'medium' ? 'border-amber-500' : 'border-green-500'
                      } bg-white/5 p-4`}
                    >
                      <div className="flex-1">
                        <label className="text-white/90">{item.text}</label>
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                          item.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                          item.priority === 'high' ? 'bg-[#5048e5]/20 text-[#a5a0f5]' :
                          item.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'
                        }`}>{item.priority}</span>
                      </div>
                      <span className="text-sm text-[#9795c6] mr-2">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Historical Trends */}
              <div className="md:col-span-1 rounded-lg p-6 bg-white/5 backdrop-blur-lg border border-white/10 flex flex-col">
                <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] mb-4">Historical Trends</h2>
                <div className="flex-grow">
                  <HistoryChart history={riskHistory} loading={historyLoading} />
                </div>
              </div>

              {/* Log Ingestion */}
              <div id="log-ingestion" className="md:col-span-3 rounded-lg p-6 bg-white/5 backdrop-blur-lg border border-white/10">
                <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] mb-4">Log Ingestion</h2>
                <LogIngest projectId={projectId} onIngested={handleRefresh} />
              </div>
            </main>
            
            {/* Platform Branding Footer */}
            <PlatformBadges />
          </div>
        </div>
      </div>
    </div>
  );
}


