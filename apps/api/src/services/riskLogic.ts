// Simple aggregation logic for risk scoring
// This is a stub implementation - will be replaced with Vultr worker in Phase 4

export interface RiskScore {
  score: number; // 0-100
  labels: string[];
  timestamp: string;
  factors: {
    errorRate?: number;
    logVolume?: number;
    latency?: number;
  };
}

export interface LogEntry {
  content: string;
  timestamp: string;
  metadata?: any;
}

/**
 * Calculate risk score based on log analysis
 * This is a simple heuristic-based approach for MVP
 */
export function calculateRiskScore(logs: LogEntry[]): RiskScore {
  if (logs.length === 0) {
    return {
      score: 0,
      labels: [],
      timestamp: new Date().toISOString(),
      factors: {},
    };
  }

  const factors: RiskScore['factors'] = {};
  const labels: string[] = [];

  // Analyze logs for errors
  const errorKeywords = ['error', 'exception', 'failed', 'failure', 'crash', 'timeout'];
  const errorCount = logs.filter(log => 
    errorKeywords.some(keyword => 
      log.content.toLowerCase().includes(keyword)
    )
  ).length;
  
  const errorRate = logs.length > 0 ? (errorCount / logs.length) * 100 : 0;
  factors.errorRate = errorRate;

  // Analyze log volume (recent logs)
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  const recentLogs = logs.filter(log => {
    const logTime = new Date(log.timestamp).getTime();
    return logTime > oneHourAgo;
  });
  
  const logVolume = recentLogs.length;
  factors.logVolume = logVolume;

  // Check for latency indicators
  const latencyKeywords = ['slow', 'timeout', 'latency', 'delay', 'waiting'];
  const latencyCount = logs.filter(log =>
    latencyKeywords.some(keyword =>
      log.content.toLowerCase().includes(keyword)
    )
  ).length;
  
  const latencyRate = logs.length > 0 ? (latencyCount / logs.length) * 100 : 0;
  factors.latency = latencyRate;

  // Calculate base risk score
  let score = 0;

  // Error rate contributes up to 50 points
  if (errorRate > 10) {
    score += Math.min(50, errorRate * 2);
    labels.push('High Error Rate');
  } else if (errorRate > 5) {
    score += Math.min(30, errorRate * 3);
    labels.push('Moderate Error Rate');
  }

  // Log volume contributes up to 30 points
  if (logVolume > 1000) {
    score += 30;
    labels.push('High Log Volume');
  } else if (logVolume > 500) {
    score += 15;
    labels.push('Elevated Log Volume');
  }

  // Latency issues contribute up to 20 points
  if (latencyRate > 5) {
    score += Math.min(20, latencyRate * 2);
    labels.push('Latency Issues');
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

/**
 * Get risk score for a project based on its logs
 */
export function getProjectRiskScore(projectLogs: LogEntry[]): RiskScore {
  return calculateRiskScore(projectLogs);
}
