'use client';

import { Forecast } from '@/lib/apiClient';

interface ForecastPanelProps {
  forecast: Forecast | null;
  loading?: boolean;
}

export default function ForecastPanel({ forecast, loading }: ForecastPanelProps) {
  if (loading) {
    return (
      <div className="rounded-lg p-6 bg-gradient-to-br from-[#5048e5]/80 to-purple-600/80 backdrop-blur-lg border border-white/10">
        <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] mb-4">AI Forecast</h2>
        <div className="text-white/70">Generating forecast...</div>
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="rounded-lg p-6 bg-gradient-to-br from-[#5048e5]/80 to-purple-600/80 backdrop-blur-lg border border-white/10">
        <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] mb-4">AI Forecast</h2>
        <div className="text-white/70">No forecast available. Ingest some logs to generate a forecast.</div>
      </div>
    );
  }

  return (
    <div className="md:col-span-3 rounded-lg p-6 bg-gradient-to-br from-[#5048e5]/80 to-purple-600/80 backdrop-blur-lg border border-white/10">
      <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] mb-4">AI Forecast</h2>
      
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <p className="text-lg text-white/90 max-w-3xl">{forecast.forecastText}</p>
        <span className="whitespace-nowrap rounded-full bg-green-500/20 px-3 py-1 text-sm font-semibold text-green-300">
          {forecast.confidence}% Confidence
        </span>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-white/70">Confidence:</span>
          <div className="flex-1 bg-white/20 rounded-full h-2">
            <div
              className="bg-white h-2 rounded-full transition-all duration-500"
              style={{ width: `${forecast.confidence}%` }}
            />
          </div>
          <span className="text-sm text-white/70">{forecast.confidence}%</span>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-white/90 mb-3">Recommended Actions</h4>
        <ol className="space-y-2">
          {forecast.actions.map((action, index) => (
            <li key={index} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-white/20 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                {index + 1}
              </span>
              <span className="text-white/90 flex-1">{action}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-6 pt-4 border-t border-white/20 text-xs text-white/50">
        Generated: {new Date(forecast.generatedAt).toLocaleString()}
      </div>
    </div>
  );
}

