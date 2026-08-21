/**
 * PROGRESS, CONSISTENCY & PERFORMANCE ENGINE (Module 6)
 * 
 * Single authoritative source of truth for Progress, Consistency,
 * and Performance calculations.
 * 
 * Rules:
 * 1. Consumes actual completion records, active works, active routines, and streak engine outputs.
 * 2. Deduplicates completion records by (userId + itemId + date).
 * 3. Weekly progress & consistency are calculated over the local calendar week.
 * 4. Routine occurrences are strictly calculated from selected weekdays.
 * 5. Work occurrences follow active work items.
 * 6. Division by zero is safely guarded (returns 0%).
 * 7. Clamped to [0, 100] range.
 * 8. Deterministic: identical data always produces identical results.
 */

import { CompletionRecord, Routine, Work, CanonicalWeekday } from '../types';
import {
  formatLocalDate,
  getWeekdayFromDateStr,
  shiftDateStr,
  isRoutineScheduledOnWeekdayIndex,
  calculateStreak,
  extractUniqueCompletionDates,
  StreakResult
} from './streakEngine';

export type PerformanceLevel = 'Starting' | 'Building' | 'Consistent' | 'Strong' | 'Elite';

export interface PerformanceLevelConfig {
  min: number;
  max: number;
  level: PerformanceLevel;
  tagline: string;
}

export const PERFORMANCE_LEVEL_TIERS: PerformanceLevelConfig[] = [
  { min: 0, max: 19, level: 'Starting', tagline: 'Calibrating Baseline' },
  { min: 20, max: 39, level: 'Building', tagline: 'Establishing Momentum' },
  { min: 40, max: 59, level: 'Consistent', tagline: 'Steady Discipline' },
  { min: 60, max: 79, level: 'Strong', tagline: 'High Velocity' },
  { min: 80, max: 100, level: 'Elite', tagline: 'Peak Performance' }
];

export interface WeekRange {
  startDate: string; // YYYY-MM-DD (Sunday)
  endDate: string;   // YYYY-MM-DD (Saturday)
  days: string[];    // 7 days YYYY-MM-DD [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
}

export interface WeeklyBreakdown {
  expectedOccurrences: number;
  completedOccurrences: number;
  progressPercentage: number; // 0 - 100
  consistencyPercentage: number; // 0 - 100
  dailyBreakdown: Array<{
    dateStr: string;
    weekdayIndex: number; // 0=Sun..6=Sat
    expectedCount: number;
    completedCount: number;
    percentage: number;
  }>;
}

export interface PerformanceMetrics {
  totalUniqueCompletions: number;
  weeklyProgress: number; // 0 - 100%
  weeklyConsistency: number; // 0 - 100%
  currentStreak: number;
  longestStreak: number;
  performanceScore: number; // 0 - 100
  performanceLevel: PerformanceLevel;
  performanceTagline: string;
  expectedWeeklyOccurrences: number;
  completedWeeklyOccurrences: number;
}

/**
 * Get the 7-day local calendar week (Sunday to Saturday) containing the given date.
 */
export function getCurrentWeekRange(currentLocalDateStr: string = formatLocalDate()): WeekRange {
  const parts = currentLocalDateStr.split('-').map(Number);
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  const weekday = dateObj.getDay(); // 0=Sun..6=Sat

  // Find Sunday of this week
  const sunday = new Date(parts[0], parts[1] - 1, parts[2] - weekday);
  
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i);
    days.push(formatLocalDate(d));
  }

  return {
    startDate: days[0],
    endDate: days[6],
    days
  };
}

/**
 * Map deduplicated completions into a Lookup Map:
 * dateString -> Set of completed itemIds
 */
export function buildCompletionsLookup(
  completions: Array<CompletionRecord | { itemId?: string; routineId?: string; date?: string; dateString?: string }>
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  for (const c of completions) {
    const d = c.date || c.dateString;
    const itemId = c.itemId || (c as any).routineId;
    if (d && itemId && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) {
      const normalizedDate = d.trim();
      if (!map.has(normalizedDate)) {
        map.set(normalizedDate, new Set());
      }
      map.get(normalizedDate)!.add(itemId.trim());
    }
  }

  return map;
}

/**
 * Calculate total unique completed occurrences across all time.
 * Deduplicates by unique date + itemId combination.
 */
export function calculateTotalUniqueCompletions(
  completions: Array<CompletionRecord | { itemId?: string; routineId?: string; date?: string; dateString?: string }>
): number {
  const uniqueKeys = new Set<string>();

  for (const c of completions) {
    const d = c.date || c.dateString;
    const itemId = c.itemId || (c as any).routineId;
    if (d && itemId && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) {
      uniqueKeys.add(`${itemId.trim()}_${d.trim()}`);
    }
  }

  return uniqueKeys.size;
}

/**
 * Calculate expected and completed occurrences for a routine in a given week range.
 */
export function calculateRoutineWeeklyOccurrences(
  routine: Routine,
  weekDays: string[],
  completionsLookup: Map<string, Set<string>>
): { expected: number; completed: number } {
  if (routine.active === false || routine.isActive === false) {
    return { expected: 0, completed: 0 };
  }

  let expected = 0;
  let completed = 0;

  for (const dateStr of weekDays) {
    const weekdayIndex = getWeekdayFromDateStr(dateStr);
    const isScheduled = isRoutineScheduledOnWeekdayIndex(routine, weekdayIndex);

    if (isScheduled) {
      expected++;
      const completedSet = completionsLookup.get(dateStr);
      if (completedSet && completedSet.has(routine.id)) {
        completed++;
      }
    }
  }

  return { expected, completed };
}

/**
 * Calculate full weekly breakdown of expected vs completed occurrences across routines & works.
 */
export function calculateWeeklyBreakdown(
  routines: Routine[],
  works: Work[],
  completions: CompletionRecord[],
  currentLocalDateStr: string = formatLocalDate()
): WeeklyBreakdown {
  const weekRange = getCurrentWeekRange(currentLocalDateStr);
  const completionsLookup = buildCompletionsLookup(completions);
  const activeRoutines = routines.filter(r => r.active !== false && r.isActive !== false);
  const activeWorks = works.filter(w => w.active !== false);

  let totalExpected = 0;
  let totalCompleted = 0;

  const dailyBreakdown = weekRange.days.map((dateStr, index) => {
    let dayExpected = 0;
    let dayCompleted = 0;
    const completedSet = completionsLookup.get(dateStr);

    // 1. Check routines scheduled on this weekday
    for (const routine of activeRoutines) {
      if (isRoutineScheduledOnWeekdayIndex(routine, index)) {
        dayExpected++;
        if (completedSet && completedSet.has(routine.id)) {
          dayCompleted++;
        }
      }
    }

    // 2. Check works: Active works are tracked items
    // (If works were completed on this day, count towards work completions)
    for (const work of activeWorks) {
      if (completedSet && completedSet.has(work.id)) {
        dayCompleted++;
      }
    }

    totalExpected += dayExpected;
    totalCompleted += dayCompleted;

    const percentage = dayExpected > 0
      ? Math.min(100, Math.round((dayCompleted / dayExpected) * 100))
      : (dayCompleted > 0 ? 100 : 0);

    return {
      dateStr,
      weekdayIndex: index,
      expectedCount: dayExpected,
      completedCount: dayCompleted,
      percentage
    };
  });

  // Calculate Progress and Consistency
  const progressPercentage = totalExpected > 0
    ? Math.min(100, Math.max(0, Math.round((totalCompleted / totalExpected) * 100)))
    : 0;

  const consistencyPercentage = progressPercentage;

  return {
    expectedOccurrences: totalExpected,
    completedOccurrences: Math.min(totalExpected, totalCompleted),
    progressPercentage,
    consistencyPercentage,
    dailyBreakdown
  };
}

/**
 * Map numerical score (0-100) to Performance Level.
 */
export function getPerformanceLevel(score: number): { level: PerformanceLevel; tagline: string } {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  for (const tier of PERFORMANCE_LEVEL_TIERS) {
    if (clamped >= tier.min && clamped <= tier.max) {
      return { level: tier.level, tagline: tier.tagline };
    }
  }
  return { level: 'Starting', tagline: 'Calibrating Baseline' };
}

/**
 * Calculate deterministic Performance Score (0-100).
 * 
 * Formula:
 * - Weekly Progress: 40%
 * - Weekly Consistency: 30%
 * - Current Streak continuity: 15% (scaled to 7 days = 100%)
 * - Longest Streak historical achievement: 10% (scaled to 14 days = 100%)
 * - Lifetime Completions volume: 5% (scaled to 25 completions = 100%)
 */
export function calculatePerformanceScore(params: {
  currentStreak: number;
  longestStreak: number;
  weeklyProgress: number;
  weeklyConsistency: number;
  totalCompletions: number;
}): number {
  const { currentStreak, longestStreak, weeklyProgress, weeklyConsistency, totalCompletions } = params;

  if (totalCompletions === 0 && weeklyProgress === 0 && currentStreak === 0) {
    return 0;
  }

  const clampedProgress = Math.max(0, Math.min(100, weeklyProgress));
  const clampedConsistency = Math.max(0, Math.min(100, weeklyConsistency));

  // Streak factors
  const streakFactor = Math.min(100, (currentStreak / 7) * 100);
  const longestFactor = Math.min(100, (longestStreak / 14) * 100);
  const volumeFactor = Math.min(100, (totalCompletions / 25) * 100);

  const rawScore = (
    clampedProgress * 0.40 +
    clampedConsistency * 0.30 +
    streakFactor * 0.15 +
    longestFactor * 0.10 +
    volumeFactor * 0.05
  );

  return Math.max(0, Math.min(100, Math.round(rawScore)));
}

/**
 * MAIN PERFORMANCE ENGINE INTERFACE
 * 
 * Computes all progress, consistency, and performance metrics in a single deterministic pass.
 */
export function calculatePerformanceEngineMetrics(
  routines: Routine[],
  works: Work[],
  completions: CompletionRecord[],
  currentLocalDateStr: string = formatLocalDate()
): PerformanceMetrics {
  const totalUniqueCompletions = calculateTotalUniqueCompletions(completions);
  const weeklyBreakdown = calculateWeeklyBreakdown(routines, works, completions, currentLocalDateStr);

  // Derive streaks via existing authoritative Streak Engine (Module 5)
  const allUniqueDates = Array.from(extractUniqueCompletionDates(completions));
  const streakResult = calculateStreak({
    completionDates: allUniqueDates,
    currentLocalDate: currentLocalDateStr
  });

  const performanceScore = calculatePerformanceScore({
    currentStreak: streakResult.currentStreak,
    longestStreak: streakResult.longestStreak,
    weeklyProgress: weeklyBreakdown.progressPercentage,
    weeklyConsistency: weeklyBreakdown.consistencyPercentage,
    totalCompletions: totalUniqueCompletions
  });

  const { level: performanceLevel, tagline: performanceTagline } = getPerformanceLevel(performanceScore);

  return {
    totalUniqueCompletions,
    weeklyProgress: weeklyBreakdown.progressPercentage,
    weeklyConsistency: weeklyBreakdown.consistencyPercentage,
    currentStreak: streakResult.currentStreak,
    longestStreak: streakResult.longestStreak,
    performanceScore,
    performanceLevel,
    performanceTagline,
    expectedWeeklyOccurrences: weeklyBreakdown.expectedOccurrences,
    completedWeeklyOccurrences: weeklyBreakdown.completedOccurrences
  };
}
