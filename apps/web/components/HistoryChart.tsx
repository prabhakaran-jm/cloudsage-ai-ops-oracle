'use client';

import { useEffect, useRef } from 'react';
import { RiskHistoryEntry } from '@/lib/apiClient';

interface HistoryChartProps {
  history: RiskHistoryEntry[];
  loading?: boolean;
}

export default function HistoryChart({ history, loading }: HistoryChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || loading || history.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, width, height);

    if (history.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data available', width / 2, height / 2);
      return;
    }

    // Prepare data
    const scores = history.map(h => h.score);
    const minScore = Math.min(0, ...scores);
    const maxScore = Math.max(100, ...scores);
    const scoreRange = maxScore - minScore || 100;

    // Draw grid lines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Draw Y-axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const value = maxScore - (scoreRange / 4) * i;
      const y = padding + (chartHeight / 4) * i;
      ctx.fillText(Math.round(value).toString(), padding - 10, y + 4);
    }

    // Draw line
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 2;
    ctx.beginPath();

    history.forEach((entry, index) => {
      const x = padding + (chartWidth / (history.length - 1 || 1)) * index;
      const normalizedScore = (entry.score - minScore) / scoreRange;
      const y = padding + chartHeight - normalizedScore * chartHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw points
    ctx.fillStyle = '#4f46e5';
    history.forEach((entry, index) => {
      const x = padding + (chartWidth / (history.length - 1 || 1)) * index;
      const normalizedScore = (entry.score - minScore) / scoreRange;
      const y = padding + chartHeight - normalizedScore * chartHeight;

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw X-axis labels (dates)
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const labelStep = Math.max(1, Math.floor(history.length / 5));
    for (let i = 0; i < history.length; i += labelStep) {
      const x = padding + (chartWidth / (history.length - 1 || 1)) * i;
      const date = new Date(history[i].timestamp);
      const label = `${date.getMonth() + 1}/${date.getDate()}`;
      ctx.fillText(label, x, height - padding + 20);
    }

    // Draw title
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Risk Score Trend', padding, 20);
  }, [history, loading]);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk History</h3>
        <div className="text-gray-600">Loading chart data...</div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk History</h3>
        <div className="text-gray-600">No risk history available. Ingest logs to see trends.</div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk History</h3>
      <canvas
        ref={canvasRef}
        width={600}
        height={300}
        className="w-full h-auto border border-gray-200 rounded"
      />
      <div className="mt-4 text-sm text-gray-500">
        Showing last {history.length} risk score{history.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
