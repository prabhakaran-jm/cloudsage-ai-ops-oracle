'use client';

import { Forecast } from '@/lib/apiClient';

interface ForecastPanelProps {
  forecast: Forecast | null;
  loading?: boolean;
}

export default function ForecastPanel({ forecast, loading }: ForecastPanelProps) {
  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Forecast</h3>
        <div className="text-gray-600">Generating forecast...</div>
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Forecast</h3>
        <div className="text-gray-600">No forecast available. Ingest some logs to generate a forecast.</div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Daily Forecast</h3>
        <div className="text-sm text-gray-500">
          {new Date(forecast.date).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-gray-700">Confidence:</span>
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full"
              style={{ width: `${forecast.confidence}%` }}
            />
          </div>
          <span className="text-sm text-gray-600">{forecast.confidence}%</span>
        </div>
      </div>

      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Forecast</h4>
        <p className="text-gray-700 leading-relaxed">{forecast.forecastText}</p>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Recommended Actions</h4>
        <ol className="space-y-2">
          {forecast.actions.map((action, index) => (
            <li key={index} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-semibold">
                {index + 1}
              </span>
              <span className="text-gray-700 flex-1">{action}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-500">
        Generated: {new Date(forecast.generatedAt).toLocaleString()}
      </div>
    </div>
  );
}

