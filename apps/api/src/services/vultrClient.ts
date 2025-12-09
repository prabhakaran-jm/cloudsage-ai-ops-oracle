// Vultr API client for risk scoring worker communication

const VULTR_WORKER_URL = process.env.VULTR_WORKER_URL || 'http://192.248.166.170:8080';
const VULTR_API_KEY = process.env.VULTR_API_KEY || 'default-key-change-in-production';

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
  try {
    const response = await fetch(`${VULTR_WORKER_URL}/score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VULTR_API_KEY}`,
        'X-API-Key': VULTR_API_KEY,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error: any = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `Vultr worker returned ${response.status}`);
    }

    const data: any = await response.json();
    return data.riskScore;
  } catch (error: any) {
    console.error('Error calling Vultr worker:', error);
    // Fallback to local calculation if Vultr worker is unavailable
    throw new Error(`Vultr worker error: ${error.message}`);
  }
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
