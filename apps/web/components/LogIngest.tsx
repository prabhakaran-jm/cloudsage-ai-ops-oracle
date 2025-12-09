'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/apiClient';

interface LogIngestProps {
  projectId: string;
  onIngested?: () => void;
}

export default function LogIngest({ projectId, onIngested }: LogIngestProps) {
  const [logContent, setLogContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      setSuccess(`Successfully ingested ${result.count} log entries`);
      setLogContent('');
      if (onIngested) {
        onIngested();
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
      setSuccess(`Successfully ingested ${result.count} log entries from file`);
      if (onIngested) {
        onIngested();
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
        <textarea
          id="logs"
          value={logContent}
          onChange={(e) => setLogContent(e.target.value)}
          placeholder="Paste your log data here..."
          className="w-full h-40 rounded-lg p-4 bg-black/30 text-white font-mono text-sm border border-white/10 focus:ring-2 focus:ring-[#5048e5] focus:border-[#5048e5] placeholder:text-white/40"
          disabled={loading}
        />
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
