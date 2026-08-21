import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { 
  collection, 
  doc, 
  addDoc,
  deleteDoc, 
  updateDoc,
  onSnapshot, 
  query, 
  where, 
  setDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { useAuth } from './AuthContext';
import { Routine, Goal, Work, CompletionRecord, CompletionHistoryEntry, UserStats, DailyStat, ConsistencyRating, ItemType, StreakResult, ItemStreakInfo, PerformanceMetrics, PerformanceLevel } from '../types';
import { calculateStreak, calculateRoutineStreak, calculateWorkStreak, calculateGlobalDisciplineStreak } from '../utils/streakEngine';
import { calculatePerformanceEngineMetrics, calculateWeeklyBreakdown, calculateTotalUniqueCompletions } from '../utils/performanceEngine';

export interface DateProgressInfo {
  dateString: string;
  weekday: number;
  totalScheduled: number;
  completedCount: number;
  remainingCount: number;
  percentage: number;
  isSuccessful: boolean;
}

interface GoalContextType {
  // Routines (Module 1 specification)
  routines: Routine[];
  goals: Routine[]; // Alias for backward compatibility
  
  // Works (Module 1 specification)
  works: Work[];
  
  // Completions (Module 1 specification)
  completions: CompletionRecord[];
  
  stats: UserStats;
  performanceMetrics: PerformanceMetrics;
  loading: boolean;
  
  // Work CRUD operations
  createWork: (workData: { title: string; description?: string }) => Promise<string>;
  updateWork: (workId: string, updates: Partial<Omit<Work, 'id' | 'userId' | 'createdAt'>>) => Promise<void>;
  deleteWork: (workId: string) => Promise<void>;
  completeWork: (workId: string, targetDateStr?: string) => Promise<{ completed: boolean; word?: string }>;
  uncompleteWork: (workId: string, targetDateStr?: string) => Promise<{ completed: boolean }>;
  toggleWorkComplete: (workId: string, targetDateStr?: string) => Promise<{ completed: boolean; word?: string }>;

  // Routine management (Permanent definitions)
  createRoutine: (routineData: any) => Promise<string>;
  createGoal: (routineData: any) => Promise<string>;
  updateRoutine: (routineId: string, updates: Partial<Omit<Routine, 'id' | 'userId' | 'createdAt'>>) => Promise<void>;
  deleteRoutine: (routineId: string) => Promise<void>;
  deleteGoal: (routineId: string) => Promise<void>;
  
  // Date-Specific Completion Engine (Occurrences & Records)
  createCompletionRecord: (recordData: {
    itemId: string;
    itemType: ItemType;
    date: string;
    routineName?: string;
    category?: any;
    emoji?: string;
    duration?: number;
  }) => Promise<string>;
  deleteCompletionRecord: (completionId: string) => Promise<void>;
  completeRoutineOccurrence: (routineId: string, targetDateStr?: string) => Promise<{ completed: boolean; word?: string }>;
  uncompleteRoutineOccurrence: (routineId: string, targetDateStr?: string) => Promise<{ completed: boolean }>;
  toggleGoalCompletion: (routineId: string, targetDateStr?: string) => Promise<{ completed: boolean; word?: string }>;
  
  // Status check selectors
  isGoalCompletedOnDate: (routineId: string, dateStr: string) => boolean;
  isGoalCompletedToday: (routine: Routine) => boolean;
  isRoutineScheduledForWeekday: (routine: Routine, weekday: number) => boolean;
  isRoutineScheduledForDate: (routine: Routine, date: string | Date) => boolean;
  
  // Streak Engine (Module 5) selectors
  getRoutineStreak: (routine: Routine) => ItemStreakInfo;
  getWorkStreak: (workId: string) => ItemStreakInfo;
  getOverallStreak: () => StreakResult;

  // Performance Engine (Module 6) selectors
  getPerformanceMetrics: () => PerformanceMetrics;

  // Unified derived query selectors
  getScheduledRoutinesForDate: (dateStr: string) => Routine[];
  getCompletedRoutinesForDate: (dateStr: string) => Routine[];
  getIncompleteRoutinesForDate: (dateStr: string) => Routine[];
  getProgressForDate: (dateStr: string) => DateProgressInfo;
  getCompletionsForDate: (dateStr: string) => CompletionRecord[];
  
  // Today's derived shortcuts
  todayScheduledRoutines: Routine[];
  todayCompletedRoutines: Routine[];
  todayIncompleteRoutines: Routine[];
  todayProgress: number;

  // System & notifications
  triggerBrowserNotification: (title: string, body: string) => void;
  requestNotificationPermission: () => Promise<boolean>;
  notificationsEnabled: boolean;
  getLocalDateString: (date?: Date) => string;
  getWeekdayIndex: (dateStr: string) => number;
}

const GoalContext = createContext<GoalContextType | undefined>(undefined);

const MOTIVATIONAL_WORDS = [
  'LOCKED IN.',
  'RELENTLESS.',
  'CONQUERED.',
  'SHOWED UP.',
  'DISCIPLINED.',
  'EXECUTION.',
  'UNSTOPPABLE.',
  'FOCUSSED.',
  'CONSISTENT.'
];

// Helper to get local date string YYYY-MM-DD avoiding UTC offset issues
export const getLocalDateString = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to parse local weekday index (0=Sun, 1=Mon, ..., 6=Sat) safely from YYYY-MM-DD
export const getWeekdayIndex = (dateStr: string): number => {
  const parts = dateStr.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]).getDay();
};

export const CANONICAL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type CanonicalWeekday = typeof CANONICAL_DAYS[number];

export const normalizeCanonicalDays = (rawDays: any): CanonicalWeekday[] => {
  if (!rawDays) return [];
  const list = Array.isArray(rawDays) ? rawDays : [rawDays];
  const set = new Set<CanonicalWeekday>();

  for (const d of list) {
    if (typeof d === 'number') {
      const numMap: { [n: number]: CanonicalWeekday } = {
        0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat'
      };
      if (numMap[d]) set.add(numMap[d]);
    } else if (typeof d === 'string') {
      const lower = d.trim().toLowerCase();
      if (lower === 'mon' || lower === 'monday') set.add('Mon');
      else if (lower === 'tue' || lower === 'tues' || lower === 'tuesday') set.add('Tue');
      else if (lower === 'wed' || lower === 'wednesday') set.add('Wed');
      else if (lower === 'thu' || lower === 'thur' || lower === 'thurs' || lower === 'thursday') set.add('Thu');
      else if (lower === 'fri' || lower === 'friday') set.add('Fri');
      else if (lower === 'sat' || lower === 'saturday') set.add('Sat');
      else if (lower === 'sun' || lower === 'sunday') set.add('Sun');
      else if (EVERYDAY_KEYWORDS.has(lower)) {
        CANONICAL_DAYS.forEach(cd => set.add(cd));
      }
    }
  }
  return CANONICAL_DAYS.filter(cd => set.has(cd));
};

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
 * Universal schedule evaluation helper.
 * Normalizes all schedule representations (explicit numbers [0..6], day names, ["daily"], ["everyday"], "daily", etc.)
 * Returns true if the routine is scheduled on the given weekday (0=Sun, 1=Mon, ..., 6=Sat).
 * Treats "Every Day" as Monday through Sunday (all seven weekdays).
 * Does NOT treat empty / undefined / null schedule as Everyday.
 * Missing reminder time does NOT prevent an Everyday routine from appearing.
 */
export const isRoutineScheduledForWeekday = (r: Routine | any, weekday: number): boolean => {
  if (!r) return false;
  if (r.active === false || r.isActive === false) return false;

  const rawSchedules = [
    r.days,
    r.repeatSchedule,
    r.repeatDays,
    r.schedule,
    r.frequency,
    r.repeat
  ].filter(s => s !== undefined && s !== null);

  if (rawSchedules.length === 0) return false;

  let hasAnyScheduleConfigured = false;
  const parsedDays = new Set<number>();
  let isEveryDay = false;

  for (const raw of rawSchedules) {
    if (typeof raw === 'string') {
      const lower = raw.trim().toLowerCase();
      if (!lower) continue;
      hasAnyScheduleConfigured = true;
      if (EVERYDAY_KEYWORDS.has(lower)) {
        isEveryDay = true;
        break;
      }
      if (WEEKDAY_MAP[lower] !== undefined) {
        parsedDays.add(WEEKDAY_MAP[lower]);
      }
    } else if (typeof raw === 'number') {
      if (raw >= 0 && raw <= 6) {
        hasAnyScheduleConfigured = true;
        parsedDays.add(raw);
      }
    } else if (Array.isArray(raw)) {
      if (raw.length === 0) continue;
      hasAnyScheduleConfigured = true;
      for (const item of raw) {
        if (item === undefined || item === null) continue;
        if (typeof item === 'number') {
          if (item >= 0 && item <= 6) {
            parsedDays.add(item);
          }
        } else if (typeof item === 'string') {
          const lower = item.trim().toLowerCase();
          if (!lower) continue;
          if (EVERYDAY_KEYWORDS.has(lower)) {
            isEveryDay = true;
            break;
          }
          if (WEEKDAY_MAP[lower] !== undefined) {
            parsedDays.add(WEEKDAY_MAP[lower]);
          }
        }
      }
      if (isEveryDay) break;
    }
  }

  // If no schedule was actually configured (e.g. empty array / empty string), return false
  if (!hasAnyScheduleConfigured) return false;

  // If marked as everyday or all 7 days are present
  if (isEveryDay || parsedDays.size >= 7) {
    return true;
  }

  return parsedDays.has(weekday);
};

export const isRoutineScheduledForDate = (r: Routine | any, dateOrDateStr: string | Date): boolean => {
  const weekday = typeof dateOrDateStr === 'string'
    ? getWeekdayIndex(dateOrDateStr)
    : dateOrDateStr.getDay();
  return isRoutineScheduledForWeekday(r, weekday);
};

export const GoalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [completions, setCompletions] = useState<CompletionRecord[]>([]);
  const [dailyStats, setDailyStats] = useState<{ [dateString: string]: DailyStat }>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(false);

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  const requestNotificationPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;
    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';
    setNotificationsEnabled(granted);
    return granted;
  };

  const triggerBrowserNotification = useCallback((title: string, body: string) => {
    if (notificationsEnabled && 'Notification' in window) {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
      });
    }
  }, [notificationsEnabled]);

  // Realtime listeners for routines, works, completions, and daily stats
  useEffect(() => {
    if (!user) {
      setRoutines([]);
      setWorks([]);
      setCompletions([]);
      setDailyStats({});
      setLoading(false);
      return;
    }

    setLoading(true);

    const worksQuery = query(collection(db, 'users', user.uid, 'works'));
    const routinesQuery = query(collection(db, 'users', user.uid, 'routines'));
    const completionsQuery = query(collection(db, 'users', user.uid, 'completions'));
    const dailyStatsQuery = query(collection(db, 'users', user.uid, 'dailyStats'));

    // Listen to works (Module 1)
    const unsubscribeWorks = onSnapshot(
      worksQuery,
      (snapshot) => {
        const worksList: Work[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          worksList.push({
            id: docSnap.id,
            userId: data.userId || user.uid,
            title: data.title || '',
            description: data.description || '',
            createdAt: data.createdAt || Date.now(),
            updatedAt: data.updatedAt || Date.now(),
            completed: !!data.completed,
            completedAt: data.completedAt || null,
            active: data.active !== undefined ? data.active : true,
          } as Work);
        });
        setWorks(worksList);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/works`);
      }
    );

    // Listen to routines
    const unsubscribeRoutines = onSnapshot(
      routinesQuery,
      (snapshot) => {
        const routinesList: Routine[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const title = data.title || data.name || 'Untitled Routine';
          const note = data.note || data.notes || '';
          const time = data.time !== undefined ? data.time : (data.reminderTime || null);
          const days = Array.isArray(data.days) ? data.days : (Array.isArray(data.repeatSchedule) ? data.repeatSchedule : []);
          const active = data.active !== undefined ? data.active : (data.isActive !== undefined ? data.isActive : true);

          routinesList.push({
            id: docSnap.id,
            userId: data.userId || user.uid,
            title,
            name: title,
            note,
            notes: note,
            time,
            reminderTime: time,
            days,
            repeatSchedule: days,
            active,
            isActive: active,
            category: data.category || 'Custom',
            emoji: data.emoji || '🎯',
            duration: data.duration ? Number(data.duration) : 30,
            createdAt: data.createdAt || Date.now(),
            updatedAt: data.updatedAt || Date.now(),
          } as Routine);
        });
        setRoutines(routinesList);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/routines`);
      }
    );

    // Listen to completions
    const unsubscribeCompletions = onSnapshot(
      completionsQuery,
      (snapshot) => {
        const completionsList: CompletionRecord[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const itemId = data.itemId || data.routineId || docSnap.id;
          const itemType = (data.itemType as ItemType) || 'routine';
          const date = data.date || data.dateString || getLocalDateString();
          
          completionsList.push({
            id: docSnap.id,
            userId: data.userId || user.uid,
            itemId,
            itemType,
            date,
            completedAt: data.completedAt || Date.now(),
            routineId: itemId,
            routineName: data.routineName || '',
            category: data.category,
            emoji: data.emoji,
            duration: data.duration,
            dateString: date
          } as CompletionRecord);
        });
        setCompletions(completionsList);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/completions`);
        setLoading(false);
      }
    );

    // Listen to dailyStats
    const unsubscribeDailyStats = onSnapshot(
      dailyStatsQuery,
      (snapshot) => {
        const statsMap: { [dateString: string]: DailyStat } = {};
        snapshot.forEach((docSnap) => {
          statsMap[docSnap.id] = { dateString: docSnap.id, ...docSnap.data() } as DailyStat;
        });
        setDailyStats(statsMap);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/dailyStats`);
      }
    );

    return () => {
      unsubscribeWorks();
      unsubscribeRoutines();
      unsubscribeCompletions();
      unsubscribeDailyStats();
    };
  }, [user]);

  // Derived completions lookup map: { [dateString: string]: Set<routineId> }
  const completionsByDate = useMemo(() => {
    const map = new Map<string, Set<string>>();
    completions.forEach((comp) => {
      if (!map.has(comp.dateString)) {
        map.set(comp.dateString, new Set());
      }
      map.get(comp.dateString)!.add(comp.routineId);
    });
    return map;
  }, [completions]);

  // Unified schedule evaluation helper hook
  const isRoutineScheduledForWeekdayCallback = useCallback((r: Routine, weekday: number): boolean => {
    return isRoutineScheduledForWeekday(r, weekday);
  }, []);

  const isRoutineScheduledForDateCallback = useCallback((r: Routine, date: string | Date): boolean => {
    return isRoutineScheduledForDate(r, date);
  }, []);

  // Check if routine is completed on a specific date
  const isGoalCompletedOnDate = useCallback((routineId: string, dateStr: string): boolean => {
    return completionsByDate.get(dateStr)?.has(routineId) ?? false;
  }, [completionsByDate]);

  const isGoalCompletedToday = useCallback((routine: Routine): boolean => {
    const todayStr = getLocalDateString();
    return isGoalCompletedOnDate(routine.id, todayStr);
  }, [isGoalCompletedOnDate]);

  const getCompletionsForDate = useCallback((dateStr: string): CompletionHistoryEntry[] => {
    return completions.filter(c => c.dateString === dateStr);
  }, [completions]);

  // Query: active routines scheduled for a given date
  const getScheduledRoutinesForDate = useCallback((dateStr: string): Routine[] => {
    const weekday = getWeekdayIndex(dateStr);
    return routines.filter(r => isRoutineScheduledForWeekday(r, weekday));
  }, [routines, isRoutineScheduledForWeekday]);

  // Query: scheduled routines completed on a given date
  const getCompletedRoutinesForDate = useCallback((dateStr: string): Routine[] => {
    const scheduled = getScheduledRoutinesForDate(dateStr);
    const dateCompletions = completionsByDate.get(dateStr);
    if (!dateCompletions) return [];
    return scheduled.filter(r => dateCompletions.has(r.id));
  }, [getScheduledRoutinesForDate, completionsByDate]);

  // Query: scheduled routines NOT yet completed on a given date (What still needs to be done)
  const getIncompleteRoutinesForDate = useCallback((dateStr: string): Routine[] => {
    const scheduled = getScheduledRoutinesForDate(dateStr);
    const dateCompletions = completionsByDate.get(dateStr);
    if (!dateCompletions) return scheduled;
    return scheduled.filter(r => !dateCompletions.has(r.id));
  }, [getScheduledRoutinesForDate, completionsByDate]);

  // Query: Progress and stats for a given date
  const getProgressForDate = useCallback((dateStr: string): DateProgressInfo => {
    const weekday = getWeekdayIndex(dateStr);
    const scheduled = getScheduledRoutinesForDate(dateStr);
    const dateCompletions = completionsByDate.get(dateStr);
    const completedCount = scheduled.filter(r => dateCompletions?.has(r.id)).length;
    const totalScheduled = scheduled.length;
    const remainingCount = totalScheduled - completedCount;
    const percentage = totalScheduled > 0 ? Math.round((completedCount / totalScheduled) * 100) : 0;
    const isSuccessful = totalScheduled > 0 && completedCount === totalScheduled;

    return {
      dateString: dateStr,
      weekday,
      totalScheduled,
      completedCount,
      remainingCount,
      percentage,
      isSuccessful
    };
  }, [getScheduledRoutinesForDate, completionsByDate]);

  // Derived collections for TODAY (Single source of truth)
  const todayDateStr = getLocalDateString();
  const todayScheduledRoutines = useMemo(() => {
    return getScheduledRoutinesForDate(todayDateStr);
  }, [getScheduledRoutinesForDate, todayDateStr]);

  const todayCompletedRoutines = useMemo(() => {
    return getCompletedRoutinesForDate(todayDateStr);
  }, [getCompletedRoutinesForDate, todayDateStr]);

  const todayIncompleteRoutines = useMemo(() => {
    return getIncompleteRoutinesForDate(todayDateStr);
  }, [getIncompleteRoutinesForDate, todayDateStr]);

  const todayProgress = useMemo(() => {
    if (todayScheduledRoutines.length === 0) return 0;
    return Math.round((todayCompletedRoutines.length / todayScheduledRoutines.length) * 100);
  }, [todayScheduledRoutines.length, todayCompletedRoutines.length]);

  // Single reliable calculation engine for all user stats (Single Source of Truth)
  const stats = useMemo<UserStats>(() => {
    const todayStr = getLocalDateString();
    const today = new Date();
    const todayWeekday = today.getDay(); // 0 = Sun, ..., 6 = Sat
    const activeRoutines = routines.filter(r => r.isActive);

    // 1. Calculate Daily Score for Today
    const todayScheduled = activeRoutines.filter(r => 
      isRoutineScheduledForWeekday(r, todayWeekday)
    );
    const todayCompletedCount = todayScheduled.filter(r => 
      completionsByDate.get(todayStr)?.has(r.id)
    ).length;
    
    const calculatedTodayProgress = todayScheduled.length > 0
      ? Math.round((todayCompletedCount / todayScheduled.length) * 100)
      : 0;

    // 2. Weekly Discipline Metrics (Sunday to Saturday of current week)
    const currentSunday = new Date(today);
    currentSunday.setDate(today.getDate() - todayWeekday);
    currentSunday.setHours(0, 0, 0, 0);

    const weeklyProgress: { [day: string]: number } = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 };
    const weeklyCounts: { [day: string]: number } = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 };

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const dayDate = new Date(currentSunday);
      dayDate.setDate(currentSunday.getDate() + dayIndex);
      const dayDateStr = getLocalDateString(dayDate);
      
      const dayScheduled = activeRoutines.filter(r => 
        isRoutineScheduledForWeekday(r, dayIndex)
      );
      
      const completedOnThisDay = dayScheduled.filter(r => 
        completionsByDate.get(dayDateStr)?.has(r.id)
      ).length;

      weeklyCounts[dayIndex.toString()] = completedOnThisDay;

      if (dayScheduled.length > 0) {
        weeklyProgress[dayIndex.toString()] = Math.round((completedOnThisDay / dayScheduled.length) * 100);
      } else {
        weeklyProgress[dayIndex.toString()] = 0;
      }
    }

    // 3. Dynamic Consistency Value (Last 7 Days Rolling Window)
    let rollingCompleted = 0;
    let rollingScheduled = 0;

    for (let i = 0; i < 7; i++) {
      const pastDate = new Date(today);
      pastDate.setDate(today.getDate() - i);
      const pastDateStr = getLocalDateString(pastDate);
      const pastWeekday = pastDate.getDay();

      const scheduledForDay = activeRoutines.filter(r => 
        isRoutineScheduledForWeekday(r, pastWeekday)
      );

      const completedForDay = scheduledForDay.filter(r => 
        completionsByDate.get(pastDateStr)?.has(r.id)
      ).length;

      rollingScheduled += scheduledForDay.length;
      rollingCompleted += completedForDay;
    }

    let completionRate = 0;
    let consistencyRating: ConsistencyRating = 'STARTING';

    if (rollingScheduled > 0 && completions.length > 0) {
      completionRate = Math.round((rollingCompleted / rollingScheduled) * 100);
    } else {
      completionRate = 0;
    }

    if (rollingScheduled === 0 || completions.length === 0) {
      consistencyRating = 'STARTING';
    } else if (completionRate >= 90) {
      consistencyRating = 'ELITE';
    } else if (completionRate >= 75) {
      consistencyRating = 'DISCIPLINED';
    } else if (completionRate >= 50) {
      consistencyRating = 'DEVELOPING';
    } else if (completionRate >= 25) {
      consistencyRating = 'INCONSISTENT';
    } else {
      consistencyRating = 'STARTING';
    }

    // 4. Consecutive-Day Streak Calculation via Single Authoritative Streak Engine (Module 5)
    const disciplineStreak = calculateGlobalDisciplineStreak(activeRoutines, completions, todayStr);
    const currentStreak = disciplineStreak.currentStreak;
    const bestStreak = disciplineStreak.longestStreak;

    // 5. Total focus time (sum of actual completed routine durations)
    const totalMinutes = completions.reduce((acc, curr) => acc + (curr.duration || 0), 0);
    const totalHoursInvested = Math.round((totalMinutes / 60) * 10) / 10;

    // 6. Performance Engine (Module 6) Metrics & Deduplication
    const perfMetrics = calculatePerformanceEngineMetrics(activeRoutines, works, completions, todayStr);

    // 7. Monthly Progress for 84-Day Heatmap
    const monthlyProgress: { [dateString: string]: number } = {};
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dStr = getLocalDateString(d);
      monthlyProgress[dStr] = completionsByDate.get(dStr)?.size || 0;
    }

    return {
      currentStreak,
      bestStreak: Math.max(currentStreak, bestStreak),
      completionRate: perfMetrics.weeklyConsistency,
      consistencyRating,
      totalGoalsCompleted: perfMetrics.totalUniqueCompletions,
      totalHoursInvested,
      todayProgress: calculatedTodayProgress,
      todayScheduledCount: todayScheduled.length,
      todayCompletedCount,
      todayRemainingCount: Math.max(0, todayScheduled.length - todayCompletedCount),
      weeklyProgress,
      weeklyCounts,
      monthlyProgress,
      // Module 6 additions
      performanceScore: perfMetrics.performanceScore,
      performanceLevel: perfMetrics.performanceLevel,
      performanceTagline: perfMetrics.performanceTagline,
      overallWeeklyProgress: perfMetrics.weeklyProgress,
      overallWeeklyConsistency: perfMetrics.weeklyConsistency,
      expectedWeeklyOccurrences: perfMetrics.expectedWeeklyOccurrences,
      completedWeeklyOccurrences: perfMetrics.completedWeeklyOccurrences
    };
  }, [routines, works, completions, completionsByDate, isRoutineScheduledForWeekday]);

  // ==========================================
  // WORK CRUD OPERATIONS (Module 1)
  // ==========================================
  const createWork = async (workData: { title: string; description?: string }): Promise<string> => {
    if (!user) throw new Error("Authentication required.");

    const title = workData.title?.trim();
    if (!title) {
      throw new Error("Validation Error: Work title cannot be empty.");
    }

    const description = workData.description?.trim() || '';
    const tempId = 'work_' + Date.now() + Math.random().toString(36).substr(2, 5);
    const now = Date.now();

    const newWork: Work = {
      id: tempId,
      userId: user.uid,
      title,
      description,
      createdAt: now,
      updatedAt: now,
      completed: false,
      completedAt: null,
      active: true
    };

    setWorks(prev => [newWork, ...prev]);

    try {
      const docRef = await addDoc(collection(db, 'users', user.uid, 'works'), {
        userId: user.uid,
        title,
        description,
        createdAt: now,
        updatedAt: now,
        completed: false,
        completedAt: null,
        active: true
      });

      setWorks(prev => prev.map(w => w.id === tempId ? { ...w, id: docRef.id } : w));
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/works`);
      setWorks(prev => prev.filter(w => w.id !== tempId));
      throw error;
    }
  };

  const updateWork = async (
    workId: string, 
    updates: Partial<Omit<Work, 'id' | 'userId' | 'createdAt'>>
  ): Promise<void> => {
    if (!user) return;
    if (updates.title !== undefined && !updates.title.trim()) {
      throw new Error("Validation Error: Work title cannot be empty.");
    }

    const previousWorks = works;
    const now = Date.now();
    const cleanUpdates = {
      ...updates,
      updatedAt: now
    };

    setWorks(prev => prev.map(w => w.id === workId ? { ...w, ...cleanUpdates } : w));

    try {
      await updateDoc(doc(db, 'users', user.uid, 'works', workId), cleanUpdates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/works/${workId}`);
      setWorks(previousWorks);
      throw error;
    }
  };

  const deleteWork = async (workId: string): Promise<void> => {
    if (!user) return;
    const previousWorks = works;
    const previousCompletions = completions;

    setWorks(prev => prev.filter(w => w.id !== workId));
    setCompletions(prev => prev.filter(c => c.itemId !== workId));

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'works', workId));

      // Clean up completions for this work
      const compsSnap = await getDocs(
        query(collection(db, 'users', user.uid, 'completions'), where('itemId', '==', workId))
      );
      if (!compsSnap.empty) {
        const batch = writeBatch(db);
        compsSnap.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/works/${workId}`);
      setWorks(previousWorks);
      setCompletions(previousCompletions);
      throw error;
    }
  };

  const completeWork = async (
    workId: string, 
    targetDateStr?: string
  ): Promise<{ completed: boolean; word?: string }> => {
    if (!user) return { completed: false };

    const work = works.find(w => w.id === workId);
    if (!work) return { completed: false };

    // Prevent duplicate completion
    if (work.completed) {
      return { completed: true, word: 'EXECUTED' };
    }

    const dateStr = targetDateStr || getLocalDateString();
    const deterministicCompId = `${workId}_${dateStr}`;
    const now = Date.now();

    const previousWorks = works;
    const previousCompletions = completions;

    // Optimistic UI updates
    const updatedWork: Work = {
      ...work,
      completed: true,
      completedAt: now,
      updatedAt: now
    };

    const newRecord: CompletionRecord = {
      id: deterministicCompId,
      userId: user.uid,
      itemId: workId,
      itemType: 'work',
      date: dateStr,
      completedAt: now,
      routineId: workId,
      routineName: work.title,
      dateString: dateStr
    };

    setWorks(prev => prev.map(w => w.id === workId ? updatedWork : w));
    setCompletions(prev => [newRecord, ...prev.filter(c => c.id !== deterministicCompId)]);

    const randomWord = 'EXECUTED';

    try {
      // 1. Save deterministic completion record
      await setDoc(doc(db, 'users', user.uid, 'completions', deterministicCompId), {
        userId: user.uid,
        itemId: workId,
        itemType: 'work',
        date: dateStr,
        completedAt: now,
        routineId: workId,
        routineName: work.title,
        dateString: dateStr
      });

      // 2. Update work document
      await updateDoc(doc(db, 'users', user.uid, 'works', workId), {
        completed: true,
        completedAt: now,
        updatedAt: now
      });

      // Trigger browser notification
      triggerBrowserNotification(
        `Work Executed!`,
        `💼 ${work.title} marked completed. ${randomWord}`
      );

      return { completed: true, word: randomWord };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/works/${workId}`);
      // Rollback optimistic state
      setWorks(previousWorks);
      setCompletions(previousCompletions);
      throw error;
    }
  };

  const uncompleteWork = async (
    workId: string, 
    targetDateStr?: string
  ): Promise<{ completed: boolean }> => {
    if (!user) return { completed: false };

    const work = works.find(w => w.id === workId);
    if (!work) return { completed: false };

    if (!work.completed) {
      return { completed: false };
    }

    const dateStr = targetDateStr || getLocalDateString();
    const deterministicCompId = `${workId}_${dateStr}`;
    const now = Date.now();

    const previousWorks = works;
    const previousCompletions = completions;

    // Optimistic UI updates
    const updatedWork: Work = {
      ...work,
      completed: false,
      completedAt: null,
      updatedAt: now
    };

    setWorks(prev => prev.map(w => w.id === workId ? updatedWork : w));
    setCompletions(prev => prev.filter(c => c.id !== deterministicCompId));

    try {
      // 1. Delete today's completion record
      await deleteDoc(doc(db, 'users', user.uid, 'completions', deterministicCompId));

      // 2. Update work document
      await updateDoc(doc(db, 'users', user.uid, 'works', workId), {
        completed: false,
        completedAt: null,
        updatedAt: now
      });

      return { completed: false };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/works/${workId}`);
      // Rollback optimistic state
      setWorks(previousWorks);
      setCompletions(previousCompletions);
      throw error;
    }
  };

  const toggleWorkComplete = async (
    workId: string,
    targetDateStr?: string
  ): Promise<{ completed: boolean; word?: string }> => {
    if (!user) return { completed: false };
    const work = works.find(w => w.id === workId);
    if (!work) return { completed: false };

    if (work.completed) {
      return uncompleteWork(workId, targetDateStr);
    } else {
      return completeWork(workId, targetDateStr);
    }
  };

  // ==========================================
  // ROUTINE CRUD OPERATIONS (Module 1)
  // ==========================================
  const createRoutine = async (routineData: {
    title?: string;
    name?: string;
    note?: string;
    notes?: string;
    time?: string | null;
    reminderTime?: string | null;
    days?: CanonicalWeekday[] | string[] | number[];
    repeatSchedule?: CanonicalWeekday[] | string[] | number[];
    category?: any;
    emoji?: string;
    duration?: number;
    active?: boolean;
    isActive?: boolean;
  }): Promise<string> => {
    if (!user) throw new Error("Authentication required.");

    const title = (routineData.title || routineData.name || '').trim();
    if (!title) {
      throw new Error("Validation Error: Routine title cannot be empty.");
    }

    const note = (routineData.note || routineData.notes || '').trim();
    const rawTime = (routineData.time || routineData.reminderTime || '').trim();
    if (!rawTime || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(rawTime)) {
      throw new Error("Validation Error: Please select a valid scheduled time (HH:mm).");
    }

    const rawDays = routineData.days || routineData.repeatSchedule || [];
    const days = normalizeCanonicalDays(rawDays);
    if (days.length === 0) {
      throw new Error("Validation Error: Please select at least one day of the week.");
    }

    const active = routineData.active !== undefined 
      ? routineData.active 
      : (routineData.isActive !== undefined ? routineData.isActive : true);

    const category = routineData.category || 'Custom';
    const emoji = routineData.emoji || '🎯';
    const duration = Number(routineData.duration) || 30;

    const tempId = 'temp_' + Date.now() + Math.random().toString(36).substr(2, 5);
    const now = Date.now();

    const newRoutine: Routine = {
      id: tempId,
      userId: user.uid,
      title,
      name: title,
      note,
      notes: note,
      time: rawTime,
      reminderTime: rawTime,
      days,
      repeatSchedule: days,
      active,
      isActive: active,
      category,
      emoji,
      duration,
      createdAt: now,
      updatedAt: now
    };

    // Optimistic UI update
    setRoutines(prev => [newRoutine, ...prev]);

    try {
      const docRef = await addDoc(collection(db, 'users', user.uid, 'routines'), {
        userId: user.uid,
        title,
        name: title,
        note,
        notes: note,
        time: rawTime,
        reminderTime: rawTime,
        days,
        repeatSchedule: days,
        active,
        isActive: active,
        category,
        emoji,
        duration,
        createdAt: now,
        updatedAt: now
      });

      // Replace temporary ID with real Firestore doc ID
      setRoutines(prev => prev.map(r => r.id === tempId ? { ...r, id: docRef.id } : r));

      if (rawTime) {
        triggerBrowserNotification(
          `Routine Created: ${title}`,
          `Scheduled for ${rawTime}. Consistency starts now!`
        );
      }

      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/routines`);
      // Rollback
      setRoutines(prev => prev.filter(r => r.id !== tempId));
      throw error;
    }
  };

  const updateRoutine = async (
    routineId: string, 
    updates: Partial<Omit<Routine, 'id' | 'userId' | 'createdAt'>>
  ): Promise<void> => {
    if (!user) return;
    
    if (updates.title !== undefined && !updates.title.trim()) {
      throw new Error("Validation Error: Routine title cannot be empty.");
    }
    if (updates.name !== undefined && !updates.name.trim()) {
      throw new Error("Validation Error: Routine name cannot be empty.");
    }
    if (updates.time !== undefined && updates.time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(updates.time.trim())) {
      throw new Error("Validation Error: Please select a valid scheduled time (HH:mm).");
    }

    const previousRoutines = routines;
    const now = Date.now();

    const cleanUpdates: any = {
      ...updates,
      updatedAt: now
    };

    if (updates.title) {
      cleanUpdates.title = updates.title.trim();
      cleanUpdates.name = updates.title.trim();
    }
    if (updates.name) {
      cleanUpdates.title = updates.name.trim();
      cleanUpdates.name = updates.name.trim();
    }
    if (updates.note !== undefined) {
      cleanUpdates.note = updates.note.trim();
      cleanUpdates.notes = updates.note.trim();
    }
    if (updates.notes !== undefined) {
      cleanUpdates.note = updates.notes.trim();
      cleanUpdates.notes = updates.notes.trim();
    }
    if (updates.time !== undefined) {
      cleanUpdates.time = updates.time;
      cleanUpdates.reminderTime = updates.time;
    }
    if (updates.reminderTime !== undefined) {
      cleanUpdates.time = updates.reminderTime;
      cleanUpdates.reminderTime = updates.reminderTime;
    }
    if (updates.days !== undefined) {
      const canonicalDays = normalizeCanonicalDays(updates.days);
      if (canonicalDays.length === 0) {
        throw new Error("Validation Error: Please select at least one day of the week.");
      }
      cleanUpdates.days = canonicalDays;
      cleanUpdates.repeatSchedule = canonicalDays;
    }
    if (updates.repeatSchedule !== undefined && updates.days === undefined) {
      const canonicalDays = normalizeCanonicalDays(updates.repeatSchedule);
      if (canonicalDays.length === 0) {
        throw new Error("Validation Error: Please select at least one day of the week.");
      }
      cleanUpdates.days = canonicalDays;
      cleanUpdates.repeatSchedule = canonicalDays;
    }
    if (updates.active !== undefined) cleanUpdates.isActive = updates.active;
    if (updates.isActive !== undefined) cleanUpdates.active = updates.isActive;

    // Optimistic local state update
    setRoutines(prev => prev.map(r => r.id === routineId ? { ...r, ...cleanUpdates } : r));

    try {
      await updateDoc(doc(db, 'users', user.uid, 'routines', routineId), cleanUpdates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/routines/${routineId}`);
      // Rollback
      setRoutines(previousRoutines);
      throw error;
    }
  };

  const deleteRoutine = async (routineId: string): Promise<void> => {
    if (!user) return;
    const previousRoutines = routines;
    const previousCompletions = completions;

    // Optimistically remove from state
    setRoutines(prev => prev.filter(r => r.id !== routineId));
    setCompletions(prev => prev.filter(c => (c.itemId !== routineId && c.routineId !== routineId)));

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'routines', routineId));
      
      // Clean up completion logs in background
      const compsSnap = await getDocs(
        query(collection(db, 'users', user.uid, 'completions'), where('itemId', '==', routineId))
      );
      if (!compsSnap.empty) {
        const batch = writeBatch(db);
        compsSnap.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/routines/${routineId}`);
      // Rollback
      setRoutines(previousRoutines);
      setCompletions(previousCompletions);
      throw error;
    }
  };

  // ==========================================
  // COMPLETION RECORDS (Module 1)
  // ==========================================
  const createCompletionRecord = async (recordData: {
    itemId: string;
    itemType: ItemType;
    date: string;
    routineName?: string;
    category?: any;
    emoji?: string;
    duration?: number;
  }): Promise<string> => {
    if (!user) throw new Error("Authentication required.");

    const { itemId, itemType, date } = recordData;
    if (!itemId || !itemId.trim()) {
      throw new Error("Validation Error: itemId is required.");
    }
    if (itemType !== 'work' && itemType !== 'routine') {
      throw new Error("Validation Error: itemType must be 'work' or 'routine'.");
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("Validation Error: date must be YYYY-MM-DD format.");
    }

    const deterministicId = `${itemId}_${date}`;
    const now = Date.now();

    const newRecord: CompletionRecord = {
      id: deterministicId,
      userId: user.uid,
      itemId,
      itemType,
      date,
      completedAt: now,
      routineId: itemId,
      routineName: recordData.routineName || '',
      category: recordData.category,
      emoji: recordData.emoji,
      duration: recordData.duration || 0,
      dateString: date
    };

    setCompletions(prev => [newRecord, ...prev.filter(c => c.id !== deterministicId)]);

    try {
      await setDoc(doc(db, 'users', user.uid, 'completions', deterministicId), {
        userId: user.uid,
        itemId,
        itemType,
        date,
        completedAt: now,
        routineId: itemId,
        routineName: recordData.routineName || '',
        category: recordData.category || null,
        emoji: recordData.emoji || null,
        duration: recordData.duration || 0,
        dateString: date
      });
      return deterministicId;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/completions/${deterministicId}`);
      setCompletions(prev => prev.filter(c => c.id !== deterministicId));
      throw error;
    }
  };

  const deleteCompletionRecord = async (completionId: string): Promise<void> => {
    if (!user) return;
    const previousCompletions = completions;

    setCompletions(prev => prev.filter(c => c.id !== completionId));

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'completions', completionId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/completions/${completionId}`);
      setCompletions(previousCompletions);
      throw error;
    }
  };

  // COMPLETE ROUTINE OCCURRENCE
  const completeRoutineOccurrence = async (
    routineId: string, 
    targetDateStr?: string
  ): Promise<{ completed: boolean; word?: string }> => {
    if (!user) return { completed: false };

    const dateStr = targetDateStr || getLocalDateString();
    const routine = routines.find(r => r.id === routineId);
    if (!routine) return { completed: false };

    // Prevent duplicate completions for the same routine + date
    if (isGoalCompletedOnDate(routineId, dateStr)) {
      return { completed: true };
    }

    const randomWord = MOTIVATIONAL_WORDS[Math.floor(Math.random() * MOTIVATIONAL_WORDS.length)];

    await createCompletionRecord({
      itemId: routine.id,
      itemType: 'routine',
      date: dateStr,
      routineName: routine.title || routine.name,
      category: routine.category,
      emoji: routine.emoji,
      duration: routine.duration || 0
    });

    // Trigger browser notification
    triggerBrowserNotification(
      `Routine Accomplished!`,
      `${routine.emoji || '🎯'} ${routine.title || routine.name} completed. ${randomWord}`
    );

    // Background update dailyStats
    (async () => {
      try {
        const weekday = getWeekdayIndex(dateStr);
        const dayScheduled = routines.filter(r => isRoutineScheduledForWeekday(r, weekday));
        const dayCompleted = completions.filter(c => (c.date === dateStr || c.dateString === dateStr) && (c.itemId !== routineId && c.routineId !== routineId)).length + 1;
        const prog = dayScheduled.length > 0 
          ? Math.round((dayCompleted / dayScheduled.length) * 100)
          : 0;

        await setDoc(doc(db, 'users', user.uid, 'dailyStats', dateStr), {
          dateString: dateStr,
          completedCount: dayCompleted,
          scheduledCount: dayScheduled.length,
          dailyProgress: prog,
          isSuccessfulDay: prog === 100 && dayScheduled.length > 0,
          updatedAt: Date.now()
        }, { merge: true });
      } catch (e) {
        console.error("Daily stat update failed", e);
      }
    })();

    return { completed: true, word: randomWord };
  };

  // UNCOMPLETE ROUTINE OCCURRENCE
  const uncompleteRoutineOccurrence = async (
    routineId: string, 
    targetDateStr?: string
  ): Promise<{ completed: boolean }> => {
    if (!user) return { completed: false };

    const dateStr = targetDateStr || getLocalDateString();
    const deterministicCompId = `${routineId}_${dateStr}`;

    await deleteCompletionRecord(deterministicCompId);

    // Clean up any legacy docs if they had random IDs
    (async () => {
      try {
        const q = query(
          collection(db, 'users', user.uid, 'completions'),
          where('itemId', '==', routineId),
          where('date', '==', dateStr)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const batch = writeBatch(db);
          querySnapshot.forEach((docSnap) => {
            batch.delete(docSnap.ref);
          });
          await batch.commit();
        }

        // Background update dailyStats
        const weekday = getWeekdayIndex(dateStr);
        const dayScheduled = routines.filter(r => isRoutineScheduledForWeekday(r, weekday));
        const dayCompleted = Math.max(0, completions.filter(c => (c.date === dateStr || c.dateString === dateStr) && (c.itemId !== routineId && c.routineId !== routineId)).length);
        const prog = dayScheduled.length > 0 
          ? Math.round((dayCompleted / dayScheduled.length) * 100)
          : 0;

        await setDoc(doc(db, 'users', user.uid, 'dailyStats', dateStr), {
          dateString: dateStr,
          completedCount: dayCompleted,
          scheduledCount: dayScheduled.length,
          dailyProgress: prog,
          isSuccessfulDay: prog === 100 && dayScheduled.length > 0,
          updatedAt: Date.now()
        }, { merge: true });
      } catch (e) {
        console.error("Daily stat update failed", e);
      }
    })();

    return { completed: false };
  };

  // Unified Toggle Completion
  const toggleGoalCompletion = async (
    routineId: string, 
    targetDateStr?: string
  ): Promise<{ completed: boolean; word?: string }> => {
    const dateStr = targetDateStr || getLocalDateString();
    const isCompleted = isGoalCompletedOnDate(routineId, dateStr);

    if (!isCompleted) {
      return completeRoutineOccurrence(routineId, dateStr);
    } else {
      return uncompleteRoutineOccurrence(routineId, dateStr);
    }
  };

  // Streak Engine (Module 5) Derived Selectors
  const getRoutineStreak = useCallback((routine: Routine): ItemStreakInfo => {
    return calculateRoutineStreak(routine, completions, getLocalDateString());
  }, [completions]);

  const getWorkStreak = useCallback((workId: string): ItemStreakInfo => {
    return calculateWorkStreak(workId, completions, getLocalDateString());
  }, [completions]);

  const getOverallStreak = useCallback((): StreakResult => {
    const active = routines.filter(r => r.isActive !== false && r.active !== false);
    return calculateGlobalDisciplineStreak(active, completions, getLocalDateString());
  }, [routines, completions]);

  // Performance Engine (Module 6) Derived Selectors
  const performanceMetrics = useMemo<PerformanceMetrics>(() => {
    const active = routines.filter(r => r.isActive !== false && r.active !== false);
    return calculatePerformanceEngineMetrics(active, works, completions, getLocalDateString());
  }, [routines, works, completions]);

  const getPerformanceMetrics = useCallback((): PerformanceMetrics => {
    const active = routines.filter(r => r.isActive !== false && r.active !== false);
    return calculatePerformanceEngineMetrics(active, works, completions, getLocalDateString());
  }, [routines, works, completions]);

  return (
    <GoalContext.Provider value={{
      routines,
      goals: routines, // Alias
      works,
      completions,
      stats,
      performanceMetrics,
      loading,
      createWork,
      updateWork,
      deleteWork,
      completeWork,
      uncompleteWork,
      toggleWorkComplete,
      createRoutine,
      createGoal: createRoutine as any, // Alias
      updateRoutine,
      deleteRoutine,
      deleteGoal: deleteRoutine, // Alias
      createCompletionRecord,
      deleteCompletionRecord,
      completeRoutineOccurrence,
      uncompleteRoutineOccurrence,
      toggleGoalCompletion,
      isGoalCompletedOnDate,
      isGoalCompletedToday,
      isRoutineScheduledForWeekday,
      isRoutineScheduledForDate,
      getRoutineStreak,
      getWorkStreak,
      getOverallStreak,
      getPerformanceMetrics,
      getScheduledRoutinesForDate,
      getCompletedRoutinesForDate,
      getIncompleteRoutinesForDate,
      getProgressForDate,
      getCompletionsForDate,
      todayScheduledRoutines,
      todayCompletedRoutines,
      todayIncompleteRoutines,
      todayProgress,
      triggerBrowserNotification,
      requestNotificationPermission,
      notificationsEnabled,
      getLocalDateString,
      getWeekdayIndex
    }}>
      {children}
    </GoalContext.Provider>
  );
};

export const useGoalTracker = () => {
  const context = useContext(GoalContext);
  if (context === undefined) {
    throw new Error('useGoalTracker must be used within a GoalProvider');
  }
  return context;
};

// Work hook convenience alias
export const useWork = () => {
  const context = useGoalTracker();
  return {
    works: context.works,
    createWork: context.createWork,
    updateWork: context.updateWork,
    deleteWork: context.deleteWork,
    completeWork: context.completeWork,
    uncompleteWork: context.uncompleteWork,
    toggleWorkComplete: context.toggleWorkComplete,
    loading: context.loading
  };
};
