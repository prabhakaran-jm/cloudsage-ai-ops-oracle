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

    // Draw background (transparent for dark theme)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, 0, width, height);

    if (history.length === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
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
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Draw Y-axis labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const value = maxScore - (scoreRange / 4) * i;
      const y = padding + (chartHeight / 4) * i;
      ctx.fillText(Math.round(value).toString(), padding - 10, y + 4);
    }

    // Draw line
    ctx.strokeStyle = '#5048e5';
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
    ctx.fillStyle = '#5048e5';
    history.forEach((entry, index) => {
      const x = padding + (chartWidth / (history.length - 1 || 1)) * index;
      const normalizedScore = (entry.score - minScore) / scoreRange;
      const y = padding + chartHeight - normalizedScore * chartHeight;

      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw X-axis labels (dates)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    const labelStep = Math.max(1, Math.floor(history.length / 3));
    for (let i = 0; i < history.length; i += labelStep) {
      const x = padding + (chartWidth / (history.length - 1 || 1)) * i;
      const date = new Date(history[i].timestamp);
      const label = `${date.getMonth() + 1}/${date.getDate()}`;
      ctx.fillText(label, x, height - padding + 15);
    }
  }, [history, loading]);

  if (loading) {
    return (
      <div className="text-white/70 text-center py-8">Loading chart data...</div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-white/50 text-sm mb-2">No risk history available.</div>
        <div className="text-white/40 text-xs">Ingest logs to see trends.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <canvas
        ref={canvasRef}
        width={300}
        height={200}
        className="w-full h-auto rounded"
      />
      <div className="mt-4 text-xs text-white/50 text-center">
        Last {history.length} score{history.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
