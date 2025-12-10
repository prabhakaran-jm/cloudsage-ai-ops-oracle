'use client';

import { useEffect } from 'react';
import { RiskScore } from '@/lib/apiClient';

interface RiskPanelProps {
  riskScore: RiskScore | null;
  loading?: boolean;
  updatedAt?: string | null;
}

export default function RiskPanel({ riskScore, loading, updatedAt }: RiskPanelProps) {
  useEffect(() => {
    console.log('[RiskPanel] Risk score prop changed:', riskScore);
  }, [riskScore]);

  if (loading) {
    return (
      <div className="text-white/70">Calculating risk score...</div>
    );
  }

  if (!riskScore) {
    return (
      <div className="flex items-center gap-3 text-white/70">
        <span> No risk data available. Ingest some logs to get started.</span>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'bg-red-500';
    if (score >= 50) return 'bg-orange-500';
    if (score >= 30) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return 'Critical';
    if (score >= 50) return 'High';
    if (score >= 30) return 'Moderate';
    if (score > 0) return 'Low';
    return 'Healthy';
  };

  const label = getScoreLabel(riskScore.score);
  const updatedLabel = updatedAt || riskScore.timestamp;

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="relative h-40 w-40">
          <svg className="h-full w-full" viewBox="0 0 100 100">
            <circle className="stroke-current text-white/10" cx="50" cy="50" fill="transparent" r="40" strokeWidth="8"></circle>
            <circle 
              className={`stroke-current ${getScoreColor(riskScore.score).replace('bg-', 'text-')} transform -rotate-90 origin-center transition-all duration-500`}
              cx="50" 
              cy="50" 
              fill="transparent" 
              r="40" 
              strokeDasharray="251.2" 
              strokeDashoffset={251.2 * (1 - riskScore.score / 100)}
              strokeLinecap="round" 
              strokeWidth="8"
            ></circle>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-bold text-white">{riskScore.score}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm text-[#9795c6]">
          <span className={`${getScoreColor(riskScore.score).replace('bg-', 'text-')}`}>●</span>
          <span>{label} Risk Level</span>
        </div>
        <div className="text-xs text-white/50">
          Last updated: {new Date(updatedLabel).toLocaleString()}
        </div>
      </div>
      
      <div className="md:col-span-2 flex flex-col justify-center">
        <div className="text-white/80 text-sm mb-3">
          {label === 'Critical' ? 'Immediate action recommended. Investigate failures and scale or rollback.' :
           label === 'High' ? 'High risk. Check recent incidents, scale resources, and review alerts.' :
           label === 'Moderate' ? 'Monitor closely. Address warnings before they escalate.' :
           label === 'Low' ? 'System looks healthy. Keep an eye on trends.' :
           'All clear. No significant risk detected.'}
        </div>
        {riskScore.labels.length > 0 && (
          <>
            <h3 className="text-lg font-bold text-white mb-3">Risk Factors</h3>
            <div className="flex flex-wrap gap-3">
              {riskScore.labels.map((label, index) => (
                <span
                  key={index}
                  className="rounded-full bg-[#5048e5]/20 px-3 py-1 text-sm font-medium text-[#5048e5]"
                >
                  {label}
                </span>
              ))}
            </div>
          </>
        )}
        
        {riskScore.factors && Object.keys(riskScore.factors).length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-white/70 mb-2">Metrics:</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {riskScore.factors.errorRate !== undefined && (
                <div>
                  <div className="text-white/50">Error Rate</div>
                  <div className="font-semibold text-white">
                    {riskScore.factors.errorRate.toFixed(1)}%
                  </div>
                </div>
              )}
              {riskScore.factors.logVolume !== undefined && (
                <div>
                  <div className="text-white/50">Log Volume</div>
                  <div className="font-semibold text-white">
                    {riskScore.factors.logVolume}
                  </div>
                </div>
              )}
              {riskScore.factors.latency !== undefined && (
                <div>
                  <div className="text-white/50">Latency Issues</div>
                  <div className="font-semibold text-white">
                    {riskScore.factors.latency.toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
