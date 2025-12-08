// Main entry point for the Raindrop-backed API
// Load environment variables from .env file
import 'dotenv/config';

import { createServer } from 'http';
import { Router } from './utils/router';
import { sendError } from './utils/response';
import { initDatabase } from './services/initDatabase';

// Import route handlers
import { handleRegister, handleLogin, handleLogout } from './routes/auth';
import {
  handleGetProjects,
  handleGetProject,
  handleCreateProject,
  handleUpdateProject,
  handleDeleteProject,
} from './routes/projects';
import { handleIngestLogs, handleGetLogs } from './routes/ingest';
import { handleGetForecast, handleGetForecastHistory, handleGetRiskHistory } from './routes/forecast';

const PORT = process.env.PORT || 3001;

const router = new Router();

// Auth routes
router.add('POST', '/api/auth/register', handleRegister);
router.add('POST', '/api/auth/login', handleLogin);
router.add('POST', '/api/auth/logout', handleLogout);

// Project routes
router.add('GET', /^\/api\/projects$/, handleGetProjects);
router.add('GET', /^\/api\/projects\/[^/]+$/, handleGetProject);
router.add('POST', '/api/projects', handleCreateProject);
router.add('PUT', /^\/api\/projects\/[^/]+$/, handleUpdateProject);
router.add('DELETE', /^\/api\/projects\/[^/]+$/, handleDeleteProject);

// Log ingestion routes
router.add('POST', '/api/ingest', handleIngestLogs);
router.add('POST', /^\/api\/ingest\/[^/]+$/, handleIngestLogs);
router.add('GET', /^\/api\/ingest\/[^/]+$/, handleGetLogs);

// Forecast routes
router.add('GET', /^\/api\/forecast\/[^/]+$/, handleGetForecast);
router.add('GET', /^\/api\/forecast\/[^/]+\/history$/, handleGetForecastHistory);
router.add('GET', /^\/api\/forecast\/[^/]+\/risk-history$/, handleGetRiskHistory);

// Hello endpoint (for testing)
router.add('GET', '/api/hello', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: 'Hello from CloudSage API!',
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));
});

const server = createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    const handled = await router.handle(req, res);
    if (!handled) {
      sendError(res, 404, 'Not found');
    }
  } catch (error) {
    console.error('Server error:', error);
    sendError(res, 500, 'Internal server error');
  }
});

// Initialize database and start server
async function startServer() {
  console.log('🔧 Initializing CloudSage API...');

  // Note: Database initialization happens in the Raindrop Service (src/api/index.ts)
  // This Node.js entry point is for local development only
  const dbInitialized = false; // Using in-memory fallback for local dev

  server.listen(PORT, () => {
    console.log(`🚀 CloudSage API server running on http://localhost:${PORT}`);
    console.log(`   Try: http://localhost:${PORT}/api/hello`);
    console.log(`   Auth: POST /api/auth/register, POST /api/auth/login`);
    console.log(`   Projects: GET /api/projects, POST /api/projects`);
    console.log(`   Ingest: POST /api/ingest/:projectId`);
    console.log(`   Forecast: GET /api/forecast/:projectId`);
    console.log(`   Vultr Worker: ${process.env.VULTR_WORKER_URL || 'http://localhost:8080'}`);
    console.log(`   Raindrop MCP: ${process.env.RAINDROP_MCP_URL || 'http://localhost:3002'}`);
    console.log(`   Raindrop Status: ${process.env.RAINDROP_API_KEY ? 'Configured' : 'Not configured (using fallback)'}`);
    console.log(`   SmartSQL: main-db ${dbInitialized ? '✓ initialized' : '⚠ using in-memory fallback'}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
