/**
 * STREAK ENGINE (Module 5)
 * 
 * Single authoritative source of truth for streak calculations.
 * Calculates streaks purely from actual completion records and calendar dates.
 * 
 * Rules:
 * 1. Works are daily scheduled items unless specified otherwise.
 * 2. Routines respect their selected weekdays.
 * 3. Unscheduled days (rest days) DO NOT break streaks.
 * 4. Today's pending occurrence does NOT break a streak before the day ends.
 * 5. Duplicate completions on the same date are deduplicated (counted once).
 * 6. Uncompleting an item recalculates streaks from remaining history deterministically.
 */

import { CompletionRecord, Routine, Work, CanonicalWeekday } from '../types';

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
}

export interface ItemStreakInfo extends StreakResult {
  itemId: string;
  itemType: 'work' | 'routine';
  lastCompletedDate: string | null;
  isCompletedToday: boolean;
}

/**
 * Format Date object to local YYYY-MM-DD string without UTC shifting.
 */
export function formatLocalDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get weekday index (0=Sun, 1=Mon, ..., 6=Sat) safely from YYYY-MM-DD.
 */
export function getWeekdayFromDateStr(dateStr: string): number {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return new Date().getDay();
  }
  return new Date(parts[0], parts[1] - 1, parts[2]).getDay();
}

/**
 * Add or subtract days from a YYYY-MM-DD date string.
 */
export function shiftDateStr(dateStr: string, offsetDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + offsetDays);
  return formatLocalDate(date);
}

const EVERYDAY_KEYWORDS = new Set([
  'daily',
  'everyday',
  'every day',
  'every_day',
  'every-day',
  'all',
  'all days',
  'all_days',
  'all-days',
  'always',
  '7days',
  '7 days'
]);

const WEEKDAY_MAP: { [key: string]: number } = {
  '0': 0, 'sun': 0, 'sunday': 0,
  '1': 1, 'mon': 1, 'monday': 1,
  '2': 2, 'tue': 2, 'tues': 2, 'tuesday': 2,
  '3': 3, 'wed': 3, 'wednesday': 3,
  '4': 4, 'thu': 4, 'thur': 4, 'thurs': 4, 'thursday': 4,
  '5': 5, 'fri': 5, 'friday': 5,
  '6': 6, 'sat': 6, 'saturday': 6
};

/**
 * Determines if a routine is scheduled on a specific weekday (0=Sun..6=Sat).
 */
export function isRoutineScheduledOnWeekdayIndex(routine: Routine | any, weekday: number): boolean {
  if (!routine) return false;
  if (routine.active === false || routine.isActive === false) return false;

  const rawSchedules = [
    routine.days,
    routine.repeatSchedule,
    routine.repeatDays,
    routine.schedule,
    routine.frequency,
    routine.repeat
  ].filter(s => s !== undefined && s !== null);

  if (rawSchedules.length === 0) return false;

  for (const raw of rawSchedules) {
    if (typeof raw === 'string') {
      const lower = raw.trim().toLowerCase();
      if (!lower) continue;
      if (EVERYDAY_KEYWORDS.has(lower)) return true;
      if (WEEKDAY_MAP[lower] === weekday) return true;
    } else if (typeof raw === 'number') {
      if (raw === weekday) return true;
    } else if (Array.isArray(raw)) {
      if (raw.length === 0) continue;
      for (const item of raw) {
        if (item === undefined || item === null) continue;
        if (typeof item === 'number' && item === weekday) return true;
        if (typeof item === 'string') {
          const lower = item.trim().toLowerCase();
          if (!lower) continue;
          if (EVERYDAY_KEYWORDS.has(lower)) return true;
          if (WEEKDAY_MAP[lower] === weekday) return true;
        }
      }
    }
  }

  return false;
}

/**
 * Deduplicate raw completion dates and return a set of unique YYYY-MM-DD strings.
 */
export function extractUniqueCompletionDates(
  completions: Array<CompletionRecord | { date?: string; dateString?: string }>
): Set<string> {
  const dates = new Set<string>();
  for (const c of completions) {
    const d = c.date || c.dateString;
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) {
      dates.add(d.trim());
    }
  }
  return dates;
}

export interface CalculateStreakOptions {
  /** Array of YYYY-MM-DD completion date strings or raw completion records */
  completionDates: Array<string | CompletionRecord | { date?: string; dateString?: string }>;
  /** Current local date in YYYY-MM-DD. Defaults to today's local date. */
  currentLocalDate?: string;
  /** Function determining if a given date string is scheduled. Defaults to daily (always true). */
  isDateScheduled?: (dateStr: string) => boolean;
  /** Maximum days to look back when scanning historical streaks (default: 730 / 2 years) */
  maxLookbackDays?: number;
}

/**
 * PURE DETERMINISTIC STREAK CALCULATION ENGINE
 * 
 * Calculates currentStreak, longestStreak, and totalCompletions based strictly
 * on actual completion history and schedule continuity.
 */
export function calculateStreak(options: CalculateStreakOptions): StreakResult {
  const currentLocalDate = options.currentLocalDate || formatLocalDate();
  const isDateScheduled = options.isDateScheduled || (() => true);
  const maxLookbackDays = options.maxLookbackDays || 730;

  // 1. Normalize and deduplicate completion dates
  const completedDatesSet = new Set<string>();
  for (const item of options.completionDates) {
    if (typeof item === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(item.trim())) {
        completedDatesSet.add(item.trim());
      }
    } else if (item && typeof item === 'object') {
      const d = item.date || item.dateString;
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) {
        completedDatesSet.add(d.trim());
      }
    }
  }

  const totalCompletions = completedDatesSet.size;

  if (totalCompletions === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalCompletions: 0
    };
  }

  // 2. Calculate CURRENT STREAK
  // Looking backwards starting from today
  let currentStreak = 0;
  const isTodayScheduled = isDateScheduled(currentLocalDate);
  const isTodayCompleted = completedDatesSet.has(currentLocalDate);

  if (isTodayScheduled) {
    if (isTodayCompleted) {
      // Completed today: Start with 1 and inspect past scheduled days
      currentStreak = 1;
      let checkDate = shiftDateStr(currentLocalDate, -1);
      let daysInspected = 0;

      while (daysInspected < maxLookbackDays) {
        if (isDateScheduled(checkDate)) {
          if (completedDatesSet.has(checkDate)) {
            currentStreak++;
          } else {
            // A scheduled day in the past was missed -> stop immediately
            break;
          }
        }
        // If not scheduled (rest day), continue looking back without breaking streak
        checkDate = shiftDateStr(checkDate, -1);
        daysInspected++;
      }
    } else {
      // Scheduled today but pending (not completed yet):
      // Do NOT break streak prematurely. Count consecutive completions up through the most recent past scheduled day.
      currentStreak = 0;
      let checkDate = shiftDateStr(currentLocalDate, -1);
      let daysInspected = 0;
      let streakActive = true;

      while (streakActive && daysInspected < maxLookbackDays) {
        if (isDateScheduled(checkDate)) {
          if (completedDatesSet.has(checkDate)) {
            currentStreak++;
          } else {
            // Most recent scheduled day was missed -> streak is 0
            streakActive = false;
            break;
          }
        }
        checkDate = shiftDateStr(checkDate, -1);
        daysInspected++;
      }
    }
  } else {
    // Today is NOT scheduled (Rest day):
    // Check backwards from yesterday
    currentStreak = 0;
    let checkDate = shiftDateStr(currentLocalDate, -1);
    let daysInspected = 0;
    let streakActive = true;

    while (streakActive && daysInspected < maxLookbackDays) {
      if (isDateScheduled(checkDate)) {
        if (completedDatesSet.has(checkDate)) {
          currentStreak++;
        } else {
          // Missed past scheduled day
          streakActive = false;
          break;
        }
      }
      checkDate = shiftDateStr(checkDate, -1);
      daysInspected++;
    }
  }

  // 3. Calculate LONGEST (BEST) STREAK across all recorded history
  let longestStreak = currentStreak;
  const sortedCompletedDates = Array.from(completedDatesSet).sort();

  if (sortedCompletedDates.length > 0) {
    const earliestDate = sortedCompletedDates[0];
    let scanDate = earliestDate;
    let runningStreak = 0;
    let daysScanned = 0;

    // Scan day by day from the earliest recorded completion up to today
    while (scanDate <= currentLocalDate && daysScanned < maxLookbackDays + 365) {
      if (isDateScheduled(scanDate)) {
        if (completedDatesSet.has(scanDate)) {
          runningStreak++;
          if (runningStreak > longestStreak) {
            longestStreak = runningStreak;
          }
        } else {
          // Scheduled day missed:
          // If scanDate is today and today is still in progress, do NOT reset historical streak
          if (scanDate !== currentLocalDate) {
            runningStreak = 0;
          }
        }
      }
      // Unscheduled days are skipped without resetting runningStreak
      scanDate = shiftDateStr(scanDate, 1);
      daysScanned++;
    }
  }

  longestStreak = Math.max(longestStreak, currentStreak);

  return {
    currentStreak,
    longestStreak,
    totalCompletions
  };
}

/**
 * Calculate streak for a specific Work item.
 * Works are daily scheduled items.
 */
export function calculateWorkStreak(
  workId: string,
  completions: CompletionRecord[],
  currentLocalDate: string = formatLocalDate()
): ItemStreakInfo {
  // Filter completions matching this work id
  const matchingCompletions = completions.filter(
    c => c.itemId === workId || (c.itemType === 'work' && c.id.startsWith(`${workId}_`))
  );

  const datesSet = extractUniqueCompletionDates(matchingCompletions);
  const sortedDates = Array.from(datesSet).sort();
  const lastCompletedDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null;
  const isCompletedToday = datesSet.has(currentLocalDate);

  const streakResult = calculateStreak({
    completionDates: Array.from(datesSet),
    currentLocalDate,
    isDateScheduled: () => true // Daily
  });

  return {
    ...streakResult,
    itemId: workId,
    itemType: 'work',
    lastCompletedDate,
    isCompletedToday
  };
}

/**
 * Calculate streak for a specific Routine.
 * Routines respect their configured weekday schedule.
 */
export function calculateRoutineStreak(
  routine: Routine,
  completions: CompletionRecord[],
  currentLocalDate: string = formatLocalDate()
): ItemStreakInfo {
  const matchingCompletions = completions.filter(
    c => c.itemId === routine.id || c.routineId === routine.id
  );

  const datesSet = extractUniqueCompletionDates(matchingCompletions);
  const sortedDates = Array.from(datesSet).sort();
  const lastCompletedDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null;
  const isCompletedToday = datesSet.has(currentLocalDate);

  const isScheduledCallback = (dateStr: string): boolean => {
    const weekdayIndex = getWeekdayFromDateStr(dateStr);
    return isRoutineScheduledOnWeekdayIndex(routine, weekdayIndex);
  };

  const streakResult = calculateStreak({
    completionDates: Array.from(datesSet),
    currentLocalDate,
    isDateScheduled: isScheduledCallback
  });

  return {
    ...streakResult,
    itemId: routine.id,
    itemType: 'routine',
    lastCompletedDate,
    isCompletedToday
  };
}

/**
 * Calculate global discipline streak across all routines.
 * A day is successful if 100% of scheduled routines on that day were completed (with >= 1 scheduled).
 */
export function calculateGlobalDisciplineStreak(
  routines: Routine[],
  completions: CompletionRecord[],
  currentLocalDate: string = formatLocalDate()
): StreakResult {
  const activeRoutines = routines.filter(r => r.active !== false && r.isActive !== false);

  if (activeRoutines.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalCompletions: 0
    };
  }

  // Map: dateString -> Set of completed routine ids
  const completionsByDate = new Map<string, Set<string>>();
  for (const c of completions) {
    const d = c.date || c.dateString;
    const rid = c.itemId || c.routineId;
    if (d && rid && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      if (!completionsByDate.has(d)) {
        completionsByDate.set(d, new Set());
      }
      completionsByDate.get(d)!.add(rid);
    }
  }

  // Day has scheduled routines?
  const hasScheduledOnDate = (dateStr: string): boolean => {
    const weekday = getWeekdayFromDateStr(dateStr);
    return activeRoutines.some(r => isRoutineScheduledOnWeekdayIndex(r, weekday));
  };

  // Day was 100% completed?
  const isDay100Percent = (dateStr: string): boolean => {
    const weekday = getWeekdayFromDateStr(dateStr);
    const scheduled = activeRoutines.filter(r => isRoutineScheduledOnWeekdayIndex(r, weekday));
    if (scheduled.length === 0) return false;
    const completedSet = completionsByDate.get(dateStr);
    if (!completedSet) return false;
    return scheduled.every(r => completedSet.has(r.id));
  };

  // Build set of successful 100% days
  const successfulDates = new Set<string>();
  for (const dateStr of completionsByDate.keys()) {
    if (isDay100Percent(dateStr)) {
      successfulDates.add(dateStr);
    }
  }

  return calculateStreak({
    completionDates: Array.from(successfulDates),
    currentLocalDate,
    isDateScheduled: hasScheduledOnDate
  });
}
