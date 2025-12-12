'use client';

import { Forecast } from '@/lib/apiClient';

interface ForecastPanelProps {
  forecast: Forecast | null;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
}

export default function ForecastPanel({ forecast, loading, error, onRefresh }: ForecastPanelProps) {
  // Debug: Always log props
  if (typeof window !== 'undefined') {
    console.log('[ForecastPanelNew] Props:', { 
      hasForecast: !!forecast, 
      loading, 
      hasOnRefresh: !!onRefresh,
      timestamp: new Date().toISOString()
    });
  }
  
  const handleRefresh = onRefresh || (() => {
    console.warn('[ForecastPanel] Refresh clicked but no onRefresh handler provided');
    window.location.reload();
  });

  // Common container classes - CHANGED TO PINK FOR VISIBILITY
  const containerClasses = "md:col-span-3 rounded-lg p-6 bg-pink-900/90 backdrop-blur-lg border-4 border-lime-400 shadow-2xl";

  return (
    <div className={containerClasses}>
      {/* FORCE VISIBLE TEST */}
      <div className="mb-4 p-4 bg-red-500 text-white font-bold text-lg border-4 border-yellow-400 animate-pulse">
        ⚠️ FORECAST PANEL V2 (PINK MODE)
        <br/>
        <span className="text-sm font-normal">If you see this, the component is definitely working.</span>
        <br/>
        <span className="text-sm font-normal">State: {loading ? 'Loading' : !forecast ? 'No Forecast' : 'Forecast Loaded'}</span>
      </div>

      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">AI Forecast</h2>
        
        {/* Always visible refresh button */}
        <button
          onClick={(e) => {
            console.log('[ForecastPanel] Refresh button clicked!');
            if (!loading) handleRefresh();
          }}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold border transition-colors shadow-lg z-10 ${
            loading 
              ? 'bg-white/10 text-white/70 border-white/20 cursor-not-allowed' 
              : 'bg-[#5048e5] hover:bg-[#5048e5]/90 border-[#5048e5]'
          }`}
          aria-label="Refresh forecast"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Refreshing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Forecast
            </>
          )}
        </button>
      </div>

      {/* Content Area based on state */}
      <div className="content-area">
        {loading ? (
          /* Loading View */
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
              <span className="text-white/90 font-medium">SmartInference analyzing your logs...</span>
            </div>
            
            <div className="space-y-2">
              <div className="h-4 bg-white/20 rounded w-full animate-pulse"></div>
              <div className="h-4 bg-white/20 rounded w-5/6 animate-pulse"></div>
              <div className="h-4 bg-white/20 rounded w-4/6 animate-pulse"></div>
            </div>
            
            <div className="mt-6 space-y-3">
              <div className="text-sm font-medium text-white/70 mb-2">Recommended Actions</div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-white/20 rounded-full animate-pulse"></div>
                  <div className="flex-1 h-4 bg-white/20 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        ) : !forecast ? (
          /* No Forecast View */
          <div>
            {error ? (
              <div className="text-red-200">{error}</div>
            ) : (
              <div className="text-white/70">No forecast available. Ingest some logs to generate a forecast.</div>
            )}
          </div>
        ) : (
          /* Main Forecast View */
          <>
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

            {/* SmartInference Chain Execution Log */}
            {(forecast as any).chainSteps && (forecast as any).chainSteps.length > 0 && (
              <div className="mt-6 pt-4 border-t border-white/20">
                <details className="group">
                  <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-white/70 hover:text-white transition-colors">
                    <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span>⚡ View SmartInference Chain Execution</span>
                    <span className="text-xs px-2 py-0.5 bg-purple-500/20 rounded-full text-purple-300">
                      {(forecast as any).chainSteps.length} steps
                    </span>
                  </summary>
                  <div className="mt-4 pl-6 space-y-2">
                    {(forecast as any).chainSteps.map((step: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-white/80 font-mono">
                        <span className="text-purple-400 mt-0.5">{step}</span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}

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
          </>
        )}
      </div>
    </div>
  );
}
