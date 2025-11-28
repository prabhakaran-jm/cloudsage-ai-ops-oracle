// Risk scoring model implementation for Vultr worker

export interface LogEntry {
  content: string;
  timestamp: string;
  metadata?: any;
}

export interface RiskScoreResult {
  score: number; // 0-100
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
 * Calculate risk score based on log analysis
 * Enhanced version for Vultr worker with more sophisticated analysis
 */
export function calculateRiskScore(request: ScoreRequest): RiskScoreResult {
  const { logs, metadata } = request;
  
  if (logs.length === 0) {
    return {
      score: 0,
      labels: ['Healthy'],
      timestamp: new Date().toISOString(),
      factors: {},
    };
  }

  const factors: RiskScoreResult['factors'] = {};
  const labels: string[] = [];

  // Analyze logs for errors
  const errorKeywords = [
    'error', 'exception', 'failed', 'failure', 'crash', 
    'timeout', 'fatal', 'critical', 'panic', 'out of memory'
  ];
  const errorCount = logs.filter(log => 
    errorKeywords.some(keyword => 
      log.content.toLowerCase().includes(keyword)
    )
  ).length;
  
  const errorRate = logs.length > 0 ? (errorCount / logs.length) * 100 : 0;
  factors.errorRate = Math.round(errorRate * 10) / 10;

  // Analyze log volume (recent logs - last hour)
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  const recentLogs = logs.filter(log => {
    const logTime = new Date(log.timestamp).getTime();
    return logTime > oneHourAgo;
  });
  
  const logVolume = recentLogs.length;
  factors.logVolume = logVolume;

  // Check for latency indicators
  const latencyKeywords = ['slow', 'timeout', 'latency', 'delay', 'waiting', 'stuck'];
  const latencyCount = logs.filter(log =>
    latencyKeywords.some(keyword =>
      log.content.toLowerCase().includes(keyword)
    )
  ).length;
  
  const latencyRate = logs.length > 0 ? (latencyCount / logs.length) * 100 : 0;
  factors.latency = Math.round(latencyRate * 10) / 10;

  // Check for memory pressure indicators
  const memoryKeywords = ['out of memory', 'oom', 'memory pressure', 'heap', 'gc'];
  const memoryCount = logs.filter(log =>
    memoryKeywords.some(keyword =>
      log.content.toLowerCase().includes(keyword)
    )
  ).length;
  
  const memoryRate = logs.length > 0 ? (memoryCount / logs.length) * 100 : 0;
  factors.memoryPressure = Math.round(memoryRate * 10) / 10;

  // Check for CPU usage indicators
  const cpuKeywords = ['cpu overload', 'high cpu', 'cpu spike', 'throttling'];
  const cpuCount = logs.filter(log =>
    cpuKeywords.some(keyword =>
      log.content.toLowerCase().includes(keyword)
    )
  ).length;
  
  const cpuRate = logs.length > 0 ? (cpuCount / logs.length) * 100 : 0;
  factors.cpuUsage = Math.round(cpuRate * 10) / 10;

  // Calculate base risk score with weighted factors
  let score = 0;

  // Error rate contributes up to 40 points
  if (errorRate > 10) {
    score += Math.min(40, errorRate * 2);
    labels.push('High Error Rate');
  } else if (errorRate > 5) {
    score += Math.min(25, errorRate * 3);
    labels.push('Moderate Error Rate');
  } else if (errorRate > 0) {
    score += Math.min(10, errorRate * 2);
    labels.push('Low Error Rate');
  }

  // Log volume contributes up to 25 points
  if (logVolume > 2000) {
    score += 25;
    labels.push('Very High Log Volume');
  } else if (logVolume > 1000) {
    score += 20;
    labels.push('High Log Volume');
  } else if (logVolume > 500) {
    score += 10;
    labels.push('Elevated Log Volume');
  }

  // Latency issues contribute up to 20 points
  if (latencyRate > 5) {
    score += Math.min(20, latencyRate * 2);
    labels.push('Latency Issues');
  }

  // Memory pressure contributes up to 10 points
  if (memoryRate > 3) {
    score += Math.min(10, memoryRate * 2);
    labels.push('Memory Pressure');
  }

  // CPU usage contributes up to 5 points
  if (cpuRate > 2) {
    score += Math.min(5, cpuRate * 1.5);
    labels.push('CPU Issues');
  }

  // Cap score at 100
  score = Math.min(100, Math.round(score));

  // Add severity label
  if (score >= 70) {
    labels.unshift('Critical');
  } else if (score >= 50) {
    labels.unshift('High');
  } else if (score >= 30) {
    labels.unshift('Moderate');
  } else if (score > 0) {
    labels.unshift('Low');
  } else {
    labels.push('Healthy');
  }

  return {
    score,
    labels: [...new Set(labels)], // Remove duplicates
    timestamp: new Date().toISOString(),
    factors,
  };
}
