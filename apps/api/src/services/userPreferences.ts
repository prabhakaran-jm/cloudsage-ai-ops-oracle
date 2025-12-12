// User preferences and learning service using SmartMemory
// Stores user-specific preferences and learned patterns for personalization

import { smartMemory } from './raindropSmart';

export interface UserPreferences {
  alertThreshold: number; // Risk score threshold for alerts (default: 50)
  ignoredPatterns: string[]; // Risk labels user has marked as "false positive"
  actionCompletionRate: Record<string, number>; // Track which actions user completes
  preferredActionTypes: string[]; // Types of actions user prefers (e.g., "database", "scaling")
  lastUpdated: string;
}

export interface UserFeedback {
  forecastId: string;
  actionId: number;
  actionText: string;
  completed: boolean;
  timestamp: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  alertThreshold: 50,
  ignoredPatterns: [],
  actionCompletionRate: {},
  preferredActionTypes: [],
  lastUpdated: new Date().toISOString(),
};

/**
 * Get user preferences from SmartMemory
 */
export async function getUserPreferences(userId: string, env?: any): Promise<UserPreferences> {
  try {
    const prefs = await smartMemory.get('user', `user:${userId}:preferences`, env);
    if (prefs) {
      return { ...DEFAULT_PREFERENCES, ...prefs };
    }
  } catch (error) {
    console.warn('Failed to get user preferences:', error);
  }
  return DEFAULT_PREFERENCES;
}

/**
 * Save user preferences to SmartMemory
 */
export async function saveUserPreferences(
  userId: string,
  preferences: Partial<UserPreferences>,
  env?: any
): Promise<boolean> {
  try {
    const existing = await getUserPreferences(userId, env);
    const updated = {
      ...existing,
      ...preferences,
      lastUpdated: new Date().toISOString(),
    };
    await smartMemory.set('user', `user:${userId}:preferences`, updated, undefined, env);
    return true;
  } catch (error) {
    console.warn('Failed to save user preferences:', error);
    return false;
  }
}

/**
 * Record user feedback on forecast actions
 * This helps CloudSage learn which actions are most useful
 */
export async function recordUserFeedback(
  userId: string,
  projectId: string,
  feedback: UserFeedback,
  env?: any
): Promise<boolean> {
  try {
    // Get existing feedback history
    const feedbackKey = `user:${userId}:feedback:${projectId}`;
    const history = await smartMemory.get('user', feedbackKey, env) || [];
    
    // Add new feedback
    const updatedHistory = [...history, feedback].slice(-50); // Keep last 50 feedback entries
    
    await smartMemory.set('user', feedbackKey, updatedHistory, undefined, env);
    
    // Update action completion rates in preferences
    const prefs = await getUserPreferences(userId, env);
    const actionKey = feedback.actionText.toLowerCase();
    const currentRate = prefs.actionCompletionRate[actionKey] || 0;
    const newRate = feedback.completed 
      ? Math.min(100, currentRate + 5) // Increase completion rate
      : Math.max(0, currentRate - 2); // Decrease if not completed
    
    prefs.actionCompletionRate[actionKey] = newRate;
    await saveUserPreferences(userId, prefs, env);
    
    return true;
  } catch (error) {
    console.warn('Failed to record user feedback:', error);
    return false;
  }
}

/**
 * Get learned patterns for a user
 * Returns patterns about which actions they complete and which risk factors they ignore
 */
export async function getLearnedPatterns(
  userId: string,
  projectId: string,
  env?: any
): Promise<{
  ignoredPatterns: string[];
  preferredActions: string[];
  completionRates: Record<string, number>;
}> {
  const prefs = await getUserPreferences(userId, env);
  
  // Get feedback history for this project
  const feedbackKey = `user:${userId}:feedback:${projectId}`;
  const feedbackHistory = await smartMemory.get('user', feedbackKey, env) || [];
  
  // Analyze which action types user completes most
  const actionTypeCounts: Record<string, { completed: number; total: number }> = {};
  feedbackHistory.forEach((fb: UserFeedback) => {
    const actionType = extractActionType(fb.actionText);
    if (!actionTypeCounts[actionType]) {
      actionTypeCounts[actionType] = { completed: 0, total: 0 };
    }
    actionTypeCounts[actionType].total++;
    if (fb.completed) {
      actionTypeCounts[actionType].completed++;
    }
  });
  
  // Find preferred action types (completion rate > 60%)
  const preferredActions = Object.entries(actionTypeCounts)
    .filter(([_, counts]) => counts.total >= 2 && counts.completed / counts.total > 0.6)
    .map(([type, _]) => type);
  
  return {
    ignoredPatterns: prefs.ignoredPatterns,
    preferredActions,
    completionRates: prefs.actionCompletionRate,
  };
}

/**
 * Extract action type from action text
 */
function extractActionType(actionText: string): string {
  const lower = actionText.toLowerCase();
  if (lower.includes('database') || lower.includes('db') || lower.includes('query')) return 'database';
  if (lower.includes('scale') || lower.includes('resource') || lower.includes('capacity')) return 'scaling';
  if (lower.includes('error') || lower.includes('log') || lower.includes('fix')) return 'error-handling';
  if (lower.includes('monitor') || lower.includes('alert') || lower.includes('watch')) return 'monitoring';
  if (lower.includes('memory') || lower.includes('cpu') || lower.includes('performance')) return 'performance';
  return 'general';
}

/**
 * Mark a risk pattern as ignored (false positive)
 */
export async function ignoreRiskPattern(
  userId: string,
  pattern: string,
  env?: any
): Promise<boolean> {
  const prefs = await getUserPreferences(userId, env);
  if (!prefs.ignoredPatterns.includes(pattern)) {
    prefs.ignoredPatterns.push(pattern);
    return await saveUserPreferences(userId, prefs, env);
  }
  return true;
}
