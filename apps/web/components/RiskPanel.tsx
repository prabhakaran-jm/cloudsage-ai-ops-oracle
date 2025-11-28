'use client';

import { RiskScore } from '@/lib/apiClient';

interface RiskPanelProps {
  riskScore: RiskScore | null;
  loading?: boolean;
}

export default function RiskPanel({ riskScore, loading }: RiskPanelProps) {
  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Score</h3>
        <div className="text-gray-600">Calculating risk score...</div>
      </div>
    );
  }

  if (!riskScore) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Score</h3>
        <div className="text-gray-600">No risk data available. Ingest some logs to get started.</div>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'bg-red-600';
    if (score >= 50) return 'bg-orange-600';
    if (score >= 30) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return 'Critical';
    if (score >= 50) return 'High';
    if (score >= 30) return 'Moderate';
    if (score > 0) return 'Low';
    return 'Healthy';
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Score</h3>
      
      <div className="flex items-center gap-6 mb-6">
        <div className={`${getScoreColor(riskScore.score)} text-white rounded-full w-24 h-24 flex items-center justify-center text-2xl font-bold`}>
          {riskScore.score}
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">{getScoreLabel(riskScore.score)}</div>
          <div className="text-sm text-gray-500">Risk Level</div>
          <div className="text-xs text-gray-400 mt-1">
            Updated: {new Date(riskScore.timestamp).toLocaleString()}
          </div>
        </div>
      </div>

      {riskScore.labels.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Risk Factors:</h4>
          <div className="flex flex-wrap gap-2">
            {riskScore.labels.map((label, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {riskScore.factors && Object.keys(riskScore.factors).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Metrics:</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {riskScore.factors.errorRate !== undefined && (
              <div>
                <div className="text-gray-500">Error Rate</div>
                <div className="font-semibold text-gray-900">
                  {riskScore.factors.errorRate.toFixed(1)}%
                </div>
              </div>
            )}
            {riskScore.factors.logVolume !== undefined && (
              <div>
                <div className="text-gray-500">Log Volume</div>
                <div className="font-semibold text-gray-900">
                  {riskScore.factors.logVolume}
                </div>
              </div>
            )}
            {riskScore.factors.latency !== undefined && (
              <div>
                <div className="text-gray-500">Latency Issues</div>
                <div className="font-semibold text-gray-900">
                  {riskScore.factors.latency.toFixed(1)}%
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
