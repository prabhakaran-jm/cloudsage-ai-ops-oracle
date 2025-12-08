// Forecast generation service using SmartInference
// Uses SmartInference when available, falls back to local generation

import { getRiskHistory } from '../routes/ingest';
import { smartMemory } from './raindropSmart';
import { runForecastInference, generateAIForecast } from './smartInferenceChains';

export interface Forecast {
  id: string;
  projectId: string;
  date: string; // YYYY-MM-DD
  forecastText: string;
  actions: string[];
  riskScore: number;
  confidence: number; // 0-100
  generatedAt: string;
}

export interface ForecastContext {
  recentRiskScores: Array<{ score: number; timestamp: string; labels: string[] }>;
  trend: 'increasing' | 'decreasing' | 'stable';
  averageScore: number;
  topRiskFactors: string[];
}

/**
 * Generate daily forecast using SmartInference
 * Tries SmartInference first, falls back to local AI-powered generation
 */
export async function generateForecast(projectId: string, date: string = new Date().toISOString().split('T')[0]): Promise<Forecast> {
  // Try SmartInference first
  const inferenceResult = await runForecastInference(projectId, date);
  
  if (inferenceResult) {
    // SmartInference succeeded
    return {
      id: `forecast_${projectId}_${date}`,
      projectId,
      date,
      forecastText: inferenceResult.forecastText,
      actions: inferenceResult.actions,
      riskScore: inferenceResult.riskScore,
      confidence: inferenceResult.confidence,
      generatedAt: new Date().toISOString(),
    };
  }
  
  // Fallback to local AI-powered generation
  console.log('Using local AI forecast generation for project:', projectId);
  
  // Get risk history for context
  const riskHistory = await getRiskHistory(projectId, 30); // Last 30 days
  
  // Get project baseline from SmartMemory (if available)
  let baseline = null;
  try {
    baseline = await smartMemory.get('project', `project:${projectId}:baseline`);
  } catch (error) {
    // Ignore, use defaults
  }
  
  // Analyze trends
  const context = analyzeRiskContext(riskHistory, baseline);
  
  // Generate forecast using AI-powered logic
  const aiResult = generateAIForecast({
    trend: context.trend,
    averageScore: context.averageScore,
    topRiskFactors: context.topRiskFactors,
    riskHistory: context.recentRiskScores,
  });
  
  // Get current risk score
  const currentScore = riskHistory.length > 0 ? riskHistory[0].score : 0;
  
  return {
    id: `forecast_${projectId}_${date}`,
    projectId,
    date,
    forecastText: aiResult.forecastText,
    actions: aiResult.actions,
    riskScore: currentScore,
    confidence: aiResult.confidence,
    generatedAt: new Date().toISOString(),
  };
}

function analyzeRiskContext(riskHistory: any[], baseline: any = null): ForecastContext {
  if (riskHistory.length === 0) {
    return {
      recentRiskScores: [],
      trend: 'stable',
      averageScore: 0,
      topRiskFactors: [],
    };
  }

  const recentScores = riskHistory.slice(0, 7).map(h => ({
    score: h.score,
    timestamp: h.timestamp,
    labels: h.labels || [],
  }));

  // Calculate trend
  const scores = recentScores.map(s => s.score);
  const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
  const secondHalf = scores.slice(Math.floor(scores.length / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (secondAvg > firstAvg + 5) trend = 'increasing';
  else if (secondAvg < firstAvg - 5) trend = 'decreasing';

  // Calculate average score
  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Extract top risk factors from labels
  const labelCounts = new Map<string, number>();
  recentScores.forEach(s => {
    const labels = Array.isArray(s.labels) ? s.labels : [];
    labels.forEach((label: string) => {
      labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
    });
  });
  
  const topRiskFactors = Array.from(labelCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label]) => label);

  return {
    recentRiskScores: recentScores,
    trend,
    averageScore: Math.round(averageScore),
    topRiskFactors,
  };
}

function generateForecastText(context: ForecastContext): string {
  const { trend, averageScore, topRiskFactors } = context;
  
  if (averageScore === 0) {
    return "Your system is showing healthy metrics with no significant risk indicators. Continue monitoring for early detection of potential issues.";
  }

  let text = `Based on analysis of recent risk scores (average: ${averageScore}/100), `;
  
  if (trend === 'increasing') {
    text += `risk levels are trending upward. `;
  } else if (trend === 'decreasing') {
    text += `risk levels are improving. `;
  } else {
    text += `risk levels remain relatively stable. `;
  }

  if (topRiskFactors.length > 0) {
    text += `Primary concerns include: ${topRiskFactors.join(', ')}. `;
  }

  if (averageScore >= 70) {
    text += `Immediate attention is recommended to prevent potential service disruptions.`;
  } else if (averageScore >= 50) {
    text += `Proactive measures should be taken to address emerging issues before they escalate.`;
  } else if (averageScore >= 30) {
    text += `Monitor closely and address minor issues to maintain system stability.`;
  } else {
    text += `Continue current monitoring practices to maintain system health.`;
  }

  return text;
}

function generateActions(context: ForecastContext): string[] {
  const { averageScore, topRiskFactors, trend } = context;
  const actions: string[] = [];

  if (topRiskFactors.length > 0) {
    const topFactor = topRiskFactors[0];
    
    if (topFactor.includes('Error')) {
      actions.push(`Review error logs and implement fixes for recurring error patterns`);
    } else if (topFactor.includes('Latency')) {
      actions.push(`Investigate performance bottlenecks and optimize slow endpoints`);
    } else if (topFactor.includes('Memory')) {
      actions.push(`Check memory usage patterns and consider scaling or optimization`);
    } else if (topFactor.includes('CPU')) {
      actions.push(`Analyze CPU usage spikes and optimize resource-intensive operations`);
    } else {
      actions.push(`Address ${topFactor.toLowerCase()} issues identified in recent analysis`);
    }
  }

  if (trend === 'increasing' && averageScore > 50) {
    actions.push(`Set up alerts for critical thresholds to catch issues early`);
  }

  if (averageScore >= 70) {
    actions.push(`Schedule immediate review of system health and prepare rollback plan if needed`);
  } else if (averageScore >= 50) {
    actions.push(`Review system metrics and plan capacity adjustments if trend continues`);
  } else {
    actions.push(`Continue regular monitoring and maintain current operational practices`);
  }

  // Ensure we always have exactly 3 actions
  while (actions.length < 3) {
    actions.push(`Monitor system metrics and review logs for any anomalies`);
  }

  return actions.slice(0, 3);
}

function calculateConfidence(dataPoints: number, context: ForecastContext): number {
  let confidence = 50; // Base confidence

  // More data points = higher confidence
  if (dataPoints >= 20) confidence += 30;
  else if (dataPoints >= 10) confidence += 20;
  else if (dataPoints >= 5) confidence += 10;

  // Clear trend = higher confidence
  if (context.trend !== 'stable') confidence += 10;

  // Multiple risk factors = higher confidence
  if (context.topRiskFactors.length >= 2) confidence += 10;

  return Math.min(100, confidence);
}

