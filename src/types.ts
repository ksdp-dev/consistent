/**
 * Types for the Consistent App Data Architecture (Module 1)
 */

export interface UserProfile {
  uid: string;
  name: string;
  age: number | null;
  email?: string;
  profileCompleted: boolean;
  onboardingCompleted?: boolean; // Backward compatibility alias
  createdAt: string | number;
  updatedAt: string | number;
}

export type GoalCategory = 'Fitness' | 'Study' | 'Reading' | 'Work' | 'Health' | 'Custom';
export type RoutineCategory = GoalCategory;
export type CanonicalWeekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface Work {
  id: string;
  userId: string;
  title: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  completed: boolean;
  completedAt: number | null;
  active: boolean;
}

export interface Routine {
  id: string;
  userId: string;
  title: string;
  name?: string; // Compatibility alias with title
  note?: string;
  notes?: string; // Compatibility alias with note
  time: string; // Deterministic "HH:mm" 24h format e.g. "07:30", "18:45"
  reminderTime?: string | null; // Compatibility alias with time
  days: CanonicalWeekday[] | string[] | number[]; // Canonical weekday array e.g. ["Mon", "Wed", "Fri"]
  repeatSchedule?: CanonicalWeekday[] | string[] | number[]; // Compatibility alias with days
  active: boolean;
  isActive?: boolean; // Compatibility alias with active
  category?: GoalCategory;
  emoji?: string;
  duration?: number; // in minutes
  createdAt: number;
  updatedAt?: number;
}

// Alias for compatibility
export type Goal = Routine & {
  completedDates?: string[];
};

export type ItemType = 'work' | 'routine';

export interface CompletionRecord {
  id: string;
  userId: string;
  itemId: string;
  itemType: ItemType;
  date: string; // YYYY-MM-DD
  completedAt: number; // timestamp
  // Backward compatibility fields for routines
  routineId?: string;
  routineName?: string;
  category?: GoalCategory;
  emoji?: string;
  duration?: number;
  dateString?: string;
}

export type CompletionHistoryEntry = CompletionRecord;

export interface DailyStat {
  dateString: string; // YYYY-MM-DD
  completedCount: number;
  scheduledCount: number;
  dailyProgress: number; // percentage (0-100)
  isSuccessfulDay: boolean;
  totalMinutes?: number;
  updatedAt?: number;
}

export type ConsistencyRating = 'ELITE' | 'DISCIPLINED' | 'DEVELOPING' | 'INCONSISTENT' | 'STARTING';
export type PerformanceLevel = 'Starting' | 'Building' | 'Consistent' | 'Strong' | 'Elite';

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

export interface UserStats {
  currentStreak: number;
  bestStreak: number;
  completionRate: number; // percentage (0-100) dynamic consistency score
  consistencyRating: ConsistencyRating;
  totalGoalsCompleted: number;
  totalHoursInvested: number; // hours spent on focused routines
  todayProgress: number; // 0-100% for today
  todayScheduledCount?: number;
  todayCompletedCount?: number;
  todayRemainingCount?: number;
  weeklyProgress: { [day: string]: number }; // weekday index (0-6) -> completion percentage (0-100)
  weeklyCounts: { [day: string]: number }; // weekday index (0-6) -> count of completed routines
  monthlyProgress: { [dateString: string]: number }; // YYYY-MM-DD -> completed count
  // Module 6 Performance Engine fields
  performanceScore: number; // 0 - 100
  performanceLevel: PerformanceLevel;
  performanceTagline: string;
  overallWeeklyProgress: number; // 0 - 100%
  overallWeeklyConsistency: number; // 0 - 100%
  expectedWeeklyOccurrences: number;
  completedWeeklyOccurrences: number;
}

export interface UserPreferences {
  theme: 'dark';
  notificationsEnabled: boolean;
}

export type AuthState = 
  | 'AUTH_LOADING'
  | 'AUTHENTICATED'
  | 'UNAUTHENTICATED'
  | 'PROFILE_INCOMPLETE'
  | 'PROFILE_COMPLETE'
  | 'AUTH_ERROR';

