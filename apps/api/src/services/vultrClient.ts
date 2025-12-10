// Vultr API client for risk scoring worker communication

const VULTR_WORKER_URL = process.env.VULTR_WORKER_URL || 'http://192.248.166.170:8080';
const VULTR_API_KEY = process.env.VULTR_API_KEY || '90ccd4ced7150948cee67d6388452f8b732037b359874c9d41ee01413d065178';
const VULTR_TIMEOUT_MS = parseInt(process.env.VULTR_TIMEOUT_MS || '8000', 10);
const VULTR_MAX_RETRIES = parseInt(process.env.VULTR_MAX_RETRIES || '2', 10);

export interface LogEntry {
  content: string;
  timestamp: string;
  metadata?: any;
}

export interface RiskScoreResult {
  score: number;
  labels: string[];
  timestamp: string;
  factors: {
    errorRate?: number;
    logVolume?: number;
    latency?: number;
    memoryPressure?: number;
    cpuUsage?: number;
  };
}

export interface ScoreRequest {
  projectId: string;
  logs: LogEntry[];
  metadata?: {
    serviceName?: string;
    environment?: string;
    region?: string;
  };
}

/**
 * Call Vultr worker to calculate risk score
 */
export async function calculateRiskScoreFromVultr(
  request: ScoreRequest
): Promise<RiskScoreResult> {
  const attempt = async (signal: AbortSignal) => {
    const response = await fetch(`${VULTR_WORKER_URL}/score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VULTR_API_KEY}`,
        'X-API-Key': VULTR_API_KEY,
      },
      body: JSON.stringify(request),
      signal,
    });

    if (!response.ok) {
      const error: any = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `Vultr worker returned ${response.status}`);
    }

    const data: any = await response.json();
    return data.riskScore;
  };

  let lastError: any = null;
  for (let i = 0; i <= VULTR_MAX_RETRIES; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VULTR_TIMEOUT_MS);
    try {
      const result = await attempt(controller.signal);
      clearTimeout(timeout);
      return result;
    } catch (err) {
      clearTimeout(timeout);
      const e: any = err;
      lastError = e;
      const isLast = i === VULTR_MAX_RETRIES;
      console.warn(`[Vultr] attempt ${i + 1}/${VULTR_MAX_RETRIES + 1} failed:`, e?.message || e);
      if (isLast) break;
      // simple backoff: 200ms * (i+1)
      await new Promise(res => setTimeout(res, 200 * (i + 1)));
    }
  }

  throw new Error(`Vultr worker error after retries: ${lastError?.message || lastError}`);
}

/**
 * Health check for Vultr worker
 */
export async function checkVultrWorkerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${VULTR_WORKER_URL}/health`, {
      method: 'GET',
      timeout: 5000,
    } as any);

    return response.ok;
  } catch {
    return false;
  }
}
