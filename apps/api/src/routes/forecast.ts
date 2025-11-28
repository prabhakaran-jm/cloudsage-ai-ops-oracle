// Forecast and risk prediction routes
import { IncomingMessage, ServerResponse } from 'http';
import { sendSuccess, sendError } from '../utils/response';
import { generateForecast, Forecast } from '../services/forecastService';
import { getRiskHistory } from './ingest';

// Forecast storage (will be replaced with SmartBuckets)
const forecasts: Map<string, Forecast> = new Map();

// Extract user ID from token
function getUserIdFromToken(req: IncomingMessage): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  try {
    const token = authHeader.substring(7);
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const userId = decoded.split(':')[0];
    return userId || null;
  } catch {
    return null;
  }
}

function requireAuth(req: IncomingMessage, res: ServerResponse): string | null {
  const userId = getUserIdFromToken(req);
  if (!userId) {
    sendError(res, 401, 'Unauthorized');
    return null;
  }
  return userId;
}

export async function handleGetForecast(req: IncomingMessage, res: ServerResponse) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const url = req.url || '';
  const parts = url.split('/').filter(p => p);
  const projectIdIndex = parts.indexOf('forecast') + 1;
  const projectId = parts[projectIdIndex];

  if (!projectId) {
    sendError(res, 400, 'Project ID is required');
    return;
  }

  // Get date from query params or use today
  const urlObj = new URL(req.url || '', 'http://localhost');
  const date = urlObj.searchParams.get('date') || new Date().toISOString().split('T')[0];

  // Check if forecast exists for this date
  const forecastKey = `${projectId}_${date}`;
  let forecast = forecasts.get(forecastKey);

  // Generate new forecast if doesn't exist or is older than 24 hours
  if (!forecast || shouldRegenerateForecast(forecast)) {
    try {
      forecast = await generateForecast(projectId, date);
      forecasts.set(forecastKey, forecast);
    } catch (error: any) {
      sendError(res, 500, `Failed to generate forecast: ${error.message}`);
      return;
    }
  }

  sendSuccess(res, { forecast });
}

export async function handleGetForecastHistory(req: IncomingMessage, res: ServerResponse) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const url = req.url || '';
  const parts = url.split('/').filter(p => p);
  const projectIdIndex = parts.indexOf('forecast') + 1;
  const projectId = parts[projectIdIndex];

  if (!projectId) {
    sendError(res, 400, 'Project ID is required');
    return;
  }

  // Get all forecasts for this project
  const projectForecasts = Array.from(forecasts.values())
    .filter(f => f.projectId === projectId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30); // Last 30 forecasts

  sendSuccess(res, { forecasts: projectForecasts });
}

export async function handleGetRiskHistory(req: IncomingMessage, res: ServerResponse) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const url = req.url || '';
  const parts = url.split('/').filter(p => p);
  const projectIdIndex = parts.indexOf('forecast') + 1;
  const projectId = parts[projectIdIndex];

  if (!projectId) {
    sendError(res, 400, 'Project ID is required');
    return;
  }

  // Get query params
  const urlObj = new URL(req.url || '', 'http://localhost');
  const limit = parseInt(urlObj.searchParams.get('limit') || '30');

  const history = getRiskHistory(projectId, limit);

  sendSuccess(res, {
    history: history.map(h => ({
      score: h.score,
      timestamp: h.timestamp,
      labels: h.labels,
    })),
  });
}

function shouldRegenerateForecast(forecast: Forecast): boolean {
  const generatedAt = new Date(forecast.generatedAt);
  const now = new Date();
  const hoursSinceGeneration = (now.getTime() - generatedAt.getTime()) / (1000 * 60 * 60);
  
  // Regenerate if older than 24 hours
  return hoursSinceGeneration > 24;
}
