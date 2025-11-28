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
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Ingest Logs</h3>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="logs" className="block text-sm font-medium text-gray-700 mb-2">
            Paste logs or upload a file
          </label>
          <textarea
            id="logs"
            value={logContent}
            onChange={(e) => setLogContent(e.target.value)}
            placeholder="Paste your logs here...&#10;&#10;Example:&#10;2024-01-01 10:00:00 ERROR: Database connection failed&#10;2024-01-01 10:00:05 INFO: Retrying connection..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
            rows={10}
            disabled={loading}
          />
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading || !logContent.trim()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Ingesting...' : 'Ingest Logs'}
          </button>

          <label className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 cursor-pointer">
            <input
              type="file"
              accept=".log,.txt"
              onChange={handleFileUpload}
              disabled={loading}
              className="hidden"
            />
            {loading ? 'Uploading...' : 'Upload File'}
          </label>
        </div>
      </form>

      <p className="mt-4 text-sm text-gray-500">
        Logs will be analyzed to calculate risk scores. You can paste multiple lines or upload a log file.
      </p>
    </div>
  );
}
