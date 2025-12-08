// Utility to parse request body
// Supports both Node.js IncomingMessage and Fetch API Request
import { IncomingMessage } from 'http';

export async function parseBody(req: any): Promise<any> {
  // Check if this is a Fetch API Request (Raindrop/Cloudflare Workers runtime)
  if (req && typeof req.json === 'function') {
    try {
      const contentType = req.headers?.get?.('content-type') || '';
      if (!contentType.includes('application/json')) {
        return {};
      }
      return await req.json();
    } catch (error) {
      // If body is empty or invalid JSON, return empty object
      return {};
    }
  }

  // Otherwise, assume Node.js IncomingMessage
  if (typeof req.on === 'function') {
    return new Promise((resolve, reject) => {
      let body = '';

      req.on('data', (chunk: any) => {
        body += chunk.toString();
      });

      req.on('end', () => {
        try {
          if (!body) {
            resolve({});
            return;
          }
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error('Invalid JSON'));
        }
      });

      req.on('error', reject);
    });
  }

  // Fallback: return empty object
  console.warn('[parseBody] Unknown request type, returning empty object');
  return {};
}

