'use client';

import { Forecast } from '@/lib/apiClient';

interface ForecastPanelProps {
  forecast: Forecast | null;
  loading?: boolean;
  error?: string;
}

export default function ForecastPanel({ forecast, loading, error }: ForecastPanelProps) {
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
        {error ? (
          <div className="text-red-200">{error}</div>
        ) : (
          <div className="text-white/70">No forecast available. Ingest some logs to generate a forecast.</div>
        )}
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

      {/* AI Reasoning Panel - Shows how CloudSage thinks */}
      {forecast.aiReasoning && (
        <div className="mt-6 pt-4 border-t border-white/20">
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-white/70 hover:text-white transition-colors">
              <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span>🧠 View AI Reasoning</span>
              <span className="text-xs px-2 py-0.5 bg-white/10 rounded-full">
                {forecast.aiReasoning.dataPointsAnalyzed} data points analyzed
              </span>
            </summary>
            <div className="mt-4 pl-6 space-y-4">
              {/* Input Signals */}
              <div>
                <h5 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Input Signals</h5>
                <div className="flex flex-wrap gap-2">
                  {forecast.aiReasoning.inputSignals.map((signal, i) => (
                    <span key={i} className="text-xs px-2 py-1 bg-white/10 rounded-lg text-white/80">
                      {signal}
                    </span>
                  ))}
                </div>
              </div>

              {/* Analysis Steps */}
              <div>
                <h5 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Analysis Pipeline</h5>
                <div className="flex flex-wrap items-center gap-1 text-xs text-white/70">
                  {forecast.aiReasoning.analysisSteps.map((step, i) => (
                    <span key={i} className="flex items-center">
                      <span className="px-2 py-1 bg-purple-500/20 rounded text-purple-200">{step}</span>
                      {i < forecast.aiReasoning!.analysisSteps.length - 1 && (
                        <span className="mx-1 text-white/40">→</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              {/* Model Info */}
              <div className="flex items-center gap-2 text-xs text-white/50">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span>Powered by {forecast.aiReasoning.modelUsed}</span>
              </div>
            </div>
          </details>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-white/20 text-xs text-white/50">
        Last updated: {new Date(forecast.generatedAt).toLocaleString()}
      </div>
    </div>
  );
}

