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
  console.log(`[RiskLogic] Calculating risk for ${logs.length} log entries`);
  
  if (logs.length === 0) {
    console.log('[RiskLogic] No logs, returning 0 score');
    return {
      score: 0,
      labels: [],
      timestamp: new Date().toISOString(),
      factors: {},
    };
  }

  const factors: RiskScore['factors'] = {};
  const labels: string[] = [];
  
  // Debug: Show first log content
  console.log('[RiskLogic] First log sample:', logs[0].content.substring(0, 100));

  // Analyze logs for errors
  const errorKeywords = ['error', 'exception', 'failed', 'failure', 'crash', 'timeout'];
  
  // Count total error occurrences across all logs (not just logs containing errors)
  let totalErrorCount = 0;
  logs.forEach(log => {
    const content = log.content.toLowerCase();
    errorKeywords.forEach(keyword => {
      // Count how many times each keyword appears
      const matches = content.match(new RegExp(keyword, 'g'));
      if (matches) {
        totalErrorCount += matches.length;
      }
    });
  });
  
  // Calculate error rate based on total errors vs log volume
  const errorRate = logs.length > 0 ? Math.min(100, (totalErrorCount / logs.length) * 10) : 0;
  factors.errorRate = errorRate;
  
  console.log(`[RiskLogic] Error analysis: ${totalErrorCount} errors in ${logs.length} logs = ${errorRate.toFixed(1)}% error rate`);

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

  // Error rate contributes up to 60 points
  if (errorRate > 50) {
    score += 60;
    labels.push('High Error Rate');
  } else if (errorRate > 20) {
    score += Math.min(45, errorRate);
    labels.push('High Error Rate');
  } else if (errorRate > 10) {
    score += Math.min(30, errorRate * 2);
    labels.push('Moderate Error Rate');
  } else if (errorRate > 5) {
    score += Math.min(20, errorRate * 2);
    labels.push('Low Error Rate');
  }

  // Log volume contributes up to 25 points
  if (logVolume > 1000) {
    score += 25;
    labels.push('High Log Volume');
  } else if (logVolume > 500) {
    score += 15;
    labels.push('Elevated Log Volume');
  } else if (logVolume > 100) {
    score += 10;
  }

  // Latency issues contribute up to 15 points
  if (latencyRate > 20) {
    score += 15;
    labels.push('Latency Issues');
  } else if (latencyRate > 10) {
    score += 10;
    labels.push('Latency Issues');
  } else if (latencyRate > 5) {
    score += 5;
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

  console.log(`[RiskLogic] Final score: ${score}, labels: ${labels.join(', ')}`);
  console.log(`[RiskLogic] Factors:`, factors);

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
