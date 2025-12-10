// SmartInference chain configurations for CloudSage
// Defines AI inference chains for forecast generation

import { smartInference, smartSQL, smartBuckets, smartMemory } from './raindropSmart';
import { getRiskHistory } from '../routes/ingest';

export interface InferenceChainConfig {
  name: string;
  description: string;
  inputs: string[];
  outputs: string[];
}

/**
 * Available inference chains
 */
export const INFERENCE_CHAINS: InferenceChainConfig[] = [
  {
    name: 'forecast_generation',
    description: 'Generate daily forecast with risk analysis and actionable recommendations',
    inputs: ['projectId', 'date', 'riskHistory', 'projectContext'],
    outputs: ['forecastText', 'actions', 'riskScore', 'confidence'],
  },
  {
    name: 'risk_analysis',
    description: 'Analyze risk patterns and identify trends',
    inputs: ['projectId', 'riskHistory'],
    outputs: ['trend', 'topRiskFactors', 'severity'],
  },
  {
    name: 'action_recommendations',
    description: 'Generate specific actionable recommendations based on risk factors',
    inputs: ['riskFactors', 'trend', 'severity'],
    outputs: ['actions'],
  },
];

/**
 * Run forecast generation inference chain
 * This is the main chain that generates daily forecasts
 */
export async function runForecastInference(
  projectId: string,
  date: string,
  env?: any
): Promise<{
  forecastText: string;
  actions: string[];
  riskScore: number;
  confidence: number;
} | null> {
  try {
    // Gather context data
    const context = await gatherForecastContext(projectId, env);
    
    // Try SmartInference
    const result = await smartInference.run('forecast_generation', {
      projectId,
      date,
      riskHistory: context.riskHistory,
      projectContext: context.projectContext,
      trend: context.trend,
      topRiskFactors: context.topRiskFactors,
      averageScore: context.averageScore,
    });
    
    if (result && result.forecastText) {
      return {
        forecastText: result.forecastText,
        actions: result.actions || [],
        riskScore: result.riskScore || context.currentScore,
        confidence: result.confidence || 75,
      };
    }
    
    return null;
  } catch (error) {
    console.warn('SmartInference not available:', error);
    return null;
  }
}

/**
 * Gather all context needed for forecast generation
 */
async function gatherForecastContext(projectId: string, env?: any) {
  // Get risk history
  const riskHistory = await getRiskHistory(projectId, 30, env);
  
  // Get project baseline from SmartMemory
  let projectContext = null;
  try {
    projectContext = await smartMemory.get('project', `project:${projectId}:baseline`);
  } catch (error) {
    // Use defaults
  }
  
  // Analyze trends
  const analysis = analyzeRiskTrends(riskHistory);
  
  return {
    riskHistory: riskHistory.slice(0, 7), // Last 7 days
    projectContext: projectContext || { baseline: 0 },
    trend: analysis.trend,
    topRiskFactors: analysis.topRiskFactors,
    averageScore: analysis.averageScore,
    currentScore: riskHistory.length > 0 ? riskHistory[0].score : 0,
  };
}

/**
 * Analyze risk trends from history
 */
function analyzeRiskTrends(riskHistory: any[]) {
  if (riskHistory.length === 0) {
    return {
      trend: 'stable' as const,
      topRiskFactors: [],
      averageScore: 0,
    };
  }

  const recentScores = riskHistory.slice(0, 7);
  const scores = recentScores.map(h => h.score);
  
  // Calculate trend
  const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
  const secondHalf = scores.slice(Math.floor(scores.length / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / (firstHalf.length || 1);
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / (secondHalf.length || 1);
  
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (secondAvg > firstAvg + 5) trend = 'increasing';
  else if (secondAvg < firstAvg - 5) trend = 'decreasing';

  // Calculate average
  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Extract top risk factors
  const labelCounts = new Map<string, number>();
  recentScores.forEach(h => {
    const labels = Array.isArray(h.labels) ? h.labels : [];
    labels.forEach((label: string) => {
      labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
    });
  });
  
  const topRiskFactors = Array.from(labelCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label]) => label);

  return {
    trend,
    topRiskFactors,
    averageScore: Math.round(averageScore),
  };
}

/**
 * Generate forecast using AI-powered analysis
 * This is a fallback implementation that mimics SmartInference behavior
 */
export function generateAIForecast(context: {
  trend: 'increasing' | 'decreasing' | 'stable';
  averageScore: number;
  topRiskFactors: string[];
  riskHistory: any[];
}): {
  forecastText: string;
  actions: string[];
  confidence: number;
} {
  const { trend, averageScore, topRiskFactors, riskHistory } = context;
  
  // Generate forecast text
  let forecastText = '';
  
  if (averageScore === 0) {
    forecastText = "Your system is showing healthy metrics with no significant risk indicators. Continue monitoring for early detection of potential issues.";
  } else {
    forecastText = `Based on analysis of recent risk scores (average: ${averageScore}/100), `;
    
    if (trend === 'increasing') {
      forecastText += `risk levels are trending upward. `;
      if (averageScore >= 70) {
        forecastText += `This upward trend combined with high risk scores indicates potential service disruptions within the next 24-48 hours. `;
      } else if (averageScore >= 50) {
        forecastText += `If this trend continues, you may experience service degradation within the next few days. `;
      }
    } else if (trend === 'decreasing') {
      forecastText += `risk levels are improving. `;
      forecastText += `Your recent interventions appear to be working. Continue monitoring to ensure sustained improvement. `;
    } else {
      forecastText += `risk levels remain relatively stable. `;
      if (averageScore >= 50) {
        forecastText += `However, sustained elevated risk requires attention to prevent future issues. `;
      }
    }

    if (topRiskFactors.length > 0) {
      forecastText += `Primary concerns include: ${topRiskFactors.join(', ')}. `;
    }

    if (averageScore >= 70) {
      forecastText += `Immediate attention is recommended to prevent potential service disruptions.`;
    } else if (averageScore >= 50) {
      forecastText += `Proactive measures should be taken to address emerging issues before they escalate.`;
    } else if (averageScore >= 30) {
      forecastText += `Monitor closely and address minor issues to maintain system stability.`;
    } else {
      forecastText += `Continue current monitoring practices to maintain system health.`;
    }
  }

  // Generate actions
  const actions = generateSmartActions(topRiskFactors, trend, averageScore);
  
  // Calculate confidence
  const confidence = calculateInferenceConfidence(riskHistory.length, trend, topRiskFactors.length);
  
  return {
    forecastText,
    actions,
    confidence,
  };
}

/**
 * Generate smart, context-aware actions
 */
function generateSmartActions(
  topRiskFactors: string[],
  trend: 'increasing' | 'decreasing' | 'stable',
  averageScore: number
): string[] {
  const actions: string[] = [];

  // Action based on top risk factor
  if (topRiskFactors.length > 0) {
    const topFactor = topRiskFactors[0];
    
    if (topFactor.toLowerCase().includes('error')) {
      actions.push(`Review error logs and implement fixes for recurring error patterns. Focus on the most frequent error types first.`);
    } else if (topFactor.toLowerCase().includes('latency') || topFactor.toLowerCase().includes('slow')) {
      actions.push(`Investigate performance bottlenecks using profiling tools. Optimize slow database queries and API endpoints.`);
    } else if (topFactor.toLowerCase().includes('memory')) {
      actions.push(`Analyze memory usage patterns and identify potential leaks. Consider increasing memory allocation or optimizing memory-intensive operations.`);
    } else if (topFactor.toLowerCase().includes('cpu')) {
      actions.push(`Profile CPU usage to identify resource-intensive operations. Optimize algorithms or consider horizontal scaling.`);
    } else if (topFactor.toLowerCase().includes('database') || topFactor.toLowerCase().includes('connection')) {
      actions.push(`Review database connection pool settings and query performance. Add indexes for slow queries and optimize connection management.`);
    } else {
      actions.push(`Address ${topFactor.toLowerCase()} issues identified in recent analysis. Review related logs and metrics for root cause.`);
    }
  }

  // Action based on trend
  if (trend === 'increasing') {
    if (averageScore >= 70) {
      actions.push(`Schedule immediate incident response review. Prepare rollback plans and notify stakeholders of potential issues.`);
    } else if (averageScore >= 50) {
      actions.push(`Set up enhanced monitoring and alerts for critical thresholds. Review recent deployments for potential causes.`);
    } else {
      actions.push(`Monitor trend closely over the next 24 hours. Document any changes in system behavior or load patterns.`);
    }
  } else if (trend === 'decreasing') {
    actions.push(`Continue current mitigation strategies. Document successful interventions for future reference and team knowledge.`);
  } else {
    // Stable trend
    if (averageScore >= 70) {
      actions.push(`Sustained high risk requires immediate action. Consider emergency maintenance window to address critical issues.`);
    } else if (averageScore >= 50) {
      actions.push(`Review system capacity and plan for scaling if needed. Address technical debt that may be contributing to elevated risk.`);
    } else {
      actions.push(`Maintain current monitoring practices. Review and update runbooks based on recent operational learnings.`);
    }
  }

  // Ensure we have exactly 3 actions
  while (actions.length < 3) {
    if (averageScore >= 50) {
      actions.push(`Review recent system changes and correlate with risk score increases. Implement additional logging for better visibility.`);
    } else {
      actions.push(`Continue regular monitoring and maintain current operational practices. Schedule routine system health review.`);
    }
  }

  return actions.slice(0, 3);
}

/**
 * Calculate confidence score for inference
 */
function calculateInferenceConfidence(
  dataPoints: number,
  trend: 'increasing' | 'decreasing' | 'stable',
  riskFactorCount: number
): number {
  let confidence = 50; // Base confidence

  // More data points = higher confidence
  if (dataPoints >= 20) confidence += 30;
  else if (dataPoints >= 10) confidence += 20;
  else if (dataPoints >= 5) confidence += 10;
  else if (dataPoints >= 2) confidence += 5;

  // Clear trend = higher confidence
  if (trend !== 'stable') confidence += 10;

  // Multiple risk factors = higher confidence in analysis
  if (riskFactorCount >= 3) confidence += 10;
  else if (riskFactorCount >= 2) confidence += 5;

  return Math.min(100, Math.max(30, confidence));
}

/**
 * Update project baseline in SmartMemory
 * This helps SmartInference learn normal patterns for each project
 */
export async function updateProjectBaseline(projectId: string, riskScore: number) {
  try {
    // Get existing baseline
    const existing = await smartMemory.get('project', `project:${projectId}:baseline`);
    
    let baseline = existing || { scores: [], average: 0, lastUpdated: null };
    
    // Add new score
    baseline.scores = baseline.scores || [];
    baseline.scores.push(riskScore);
    
    // Keep only last 30 scores
    if (baseline.scores.length > 30) {
      baseline.scores = baseline.scores.slice(-30);
    }
    
    // Calculate new average
    baseline.average = baseline.scores.reduce((a: number, b: number) => a + b, 0) / baseline.scores.length;
    baseline.lastUpdated = new Date().toISOString();
    
    // Store updated baseline
    await smartMemory.set('project', `project:${projectId}:baseline`, baseline);
    
    return baseline;
  } catch (error) {
    console.warn('Failed to update project baseline:', error);
    return null;
  }
}
