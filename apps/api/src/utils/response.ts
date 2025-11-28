// Utility functions for sending responses
import { ServerResponse } from 'http';

export function sendJSON(res: ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export function sendError(res: ServerResponse, statusCode: number, message: string) {
  sendJSON(res, statusCode, { error: message });
}

export function sendSuccess(res: ServerResponse, data: any, statusCode = 200) {
  sendJSON(res, statusCode, data);
}

