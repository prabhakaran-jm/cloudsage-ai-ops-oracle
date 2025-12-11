'use client';

import { useState } from 'react';
import { apiClient, RiskScore } from '@/lib/apiClient';

interface LogIngestProps {
  projectId: string;
  onIngested?: (riskScore?: RiskScore) => void;
}

// Sample logs for demo purposes
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

export default function LogIngest({ projectId, onIngested }: LogIngestProps) {
  const [logContent, setLogContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadSampleLogs = () => {
    setLogContent(SAMPLE_LOGS);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logContent.trim()) {
      setError('Please enter some log content');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await apiClient.ingestLogs(projectId, logContent);
      console.log('[LogIngest] Ingestion result:', result);
      console.log('[LogIngest] Risk score from ingestion:', result.riskScore);
      setSuccess(`Successfully ingested ${result.count} log entries`);
      setLogContent('');
      if (onIngested) {
        console.log('[LogIngest] Calling onIngested with risk score:', result.riskScore);
        onIngested(result.riskScore);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to ingest logs');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const text = await file.text();
      const result = await apiClient.ingestLogs(projectId, text);
      console.log('[LogIngest] File ingestion result:', result);
      console.log('[LogIngest] Risk score from file ingestion:', result.riskScore);
      setSuccess(`Successfully ingested ${result.count} log entries from file`);
      if (onIngested) {
        console.log('[LogIngest] Calling onIngested with risk score:', result.riskScore);
        onIngested(result.riskScore);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to ingest logs from file');
    } finally {
      setLoading(false);
      e.target.value = ''; // Reset file input
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/20 border border-green-500/50 text-green-300 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="relative">
          <textarea
            id="logs"
            value={logContent}
            onChange={(e) => setLogContent(e.target.value)}
            placeholder="Paste your log data here..."
            className="w-full h-40 rounded-lg p-4 bg-black/30 text-white font-mono text-sm border border-white/10 focus:ring-2 focus:ring-[#5048e5] focus:border-[#5048e5] placeholder:text-white/40"
            disabled={loading}
          />
          {!logContent && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-white/40 text-sm mb-2">No logs? Try our demo data</p>
                <button
                  type="button"
                  onClick={loadSampleLogs}
                  className="pointer-events-auto px-4 py-2 bg-[#5048e5]/30 hover:bg-[#5048e5]/50 border border-[#5048e5]/50 text-[#a5a0f5] rounded-lg text-sm font-medium transition-colors"
                >
                  📋 Load Sample Logs
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3">
          <label className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-6 bg-white/10 text-white text-sm font-bold leading-normal tracking-[0.015em] transition-colors hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed">
            <input
              type="file"
              accept=".log,.txt"
              onChange={handleFileUpload}
              disabled={loading}
              className="hidden"
            />
            <span className="truncate">{loading ? 'Uploading...' : 'Upload File'}</span>
          </label>
          <button
            type="submit"
            disabled={loading || !logContent.trim()}
            className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-6 bg-[#5048e5] hover:bg-[#5048e5]/90 text-white text-sm font-bold leading-normal tracking-[0.015em] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                <span className="truncate">Analyzing...</span>
              </>
            ) : (
              <span className="truncate">Analyze Logs</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
