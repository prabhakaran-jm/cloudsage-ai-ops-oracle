// Main entry point for Vultr worker service
// Load environment variables from .env file
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';
import { calculateRiskScore, ScoreRequest } from './model.js';

// Get current directory (ES module compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try multiple paths for .env file
const envPaths = [
  join(__dirname, '..', '.env'), // From dist/ to services/vultr-worker/.env
  join(process.cwd(), '.env'), // Current working directory
  '/root/cloudsage-ai-ops-oracle/services/vultr-worker/.env', // Absolute path
];

console.log(`📁 __dirname: ${__dirname}`);
console.log(`📁 process.cwd(): ${process.cwd()}`);

let envLoaded = false;
for (const envPath of envPaths) {
  console.log(`📁 Trying .env at: ${envPath}`);
  const result = dotenv.config({ path: envPath });
  if (!result.error && result.parsed && Object.keys(result.parsed).length > 0) {
    console.log(`✅ Loaded ${Object.keys(result.parsed).length} env vars from ${envPath}`);
    envLoaded = true;
    break;
  } else if (result.error) {
    console.log(`⚠️  ${envPath}: ${result.error.message}`);
  } else {
    console.log(`⚠️  ${envPath}: File found but empty or no variables`);
  }
}

if (!envLoaded) {
  console.warn('⚠️  No .env file loaded! Using default values.');
}

const PORT = process.env.PORT || 8080;
const API_KEY = process.env.API_KEY || 'default-key-change-in-production';

// Log API key status (first 8 chars only for security)
console.log(`🔑 API Key loaded: ${API_KEY ? API_KEY.substring(0, 8) + '...' : 'NOT FOUND'}`);

// Simple API key authentication
function requireAuth(req: any): boolean {
  const authHeader = req.headers.authorization || req.headers['x-api-key'];
  if (!authHeader) return false;
  
  const providedKey = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : authHeader;
  
  return providedKey === API_KEY;
}

async function parseBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res: any, statusCode: number, data: any) {
  res.writeHead(statusCode, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  });
  res.end(JSON.stringify(data));
}

const server = createServer(async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    });
    res.end();
    return;
  }

  // Health check endpoint (no auth required)
  if (req.url === '/health' && req.method === 'GET') {
    sendJSON(res, 200, {
      status: 'ok',
      service: 'vultr-risk-worker',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Score endpoint requires auth
  if (req.url === '/score' && req.method === 'POST') {
    if (!requireAuth(req)) {
      sendJSON(res, 401, { error: 'Unauthorized' });
      return;
    }

    try {
      const body = await parseBody(req);
      const { projectId, logs, metadata } = body;

      if (!projectId) {
        sendJSON(res, 400, { error: 'projectId is required' });
        return;
      }

      if (!logs || !Array.isArray(logs)) {
        sendJSON(res, 400, { error: 'logs array is required' });
        return;
      }

      const request: ScoreRequest = {
        projectId,
        logs: logs.map((log: any) => ({
          content: typeof log === 'string' ? log : log.content || JSON.stringify(log),
          timestamp: log.timestamp || new Date().toISOString(),
          metadata: log.metadata,
        })),
        metadata,
      };

      const riskScore = calculateRiskScore(request);

      sendJSON(res, 200, {
        projectId,
        riskScore,
      });
    } catch (error: any) {
      console.error('Error calculating risk score:', error);
      sendJSON(res, 500, { 
        error: 'Internal server error',
        message: error.message 
      });
    }
    return;
  }

  // 404 for other routes
  sendJSON(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`🚀 Vultr Risk Worker running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Score: POST http://localhost:${PORT}/score`);
});
