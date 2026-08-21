import React, { useState, useMemo } from 'react';
import { useGoalTracker } from '../context/GoalContext';
import { useAuth } from '../context/AuthContext';
import { EmptyState } from '../components/EmptyState';
import { GoalCompletedOverlay } from '../components/GoalCompletedOverlay';
import { WorkModal } from '../components/WorkModal';
import { RoutineModal } from '../components/RoutineModal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { Work, Routine, CanonicalWeekday, GoalCategory } from '../types';
import { 
  Clock, 
  CalendarDays, 
  CheckCircle2, 
  Circle, 
  Briefcase, 
  Check, 
  Sparkles, 
  ArrowRight,
  AlertCircle,
  RefreshCw,
  StickyNote,
  Plus,
  Pencil,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardProps {
  onNavigateToGoals?: () => void;
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

export const DashboardPage: React.FC<DashboardProps> = ({ onNavigateToGoals }) => {
  const { user, profile } = useAuth();
  const { 
    works,
    routines, 
    completions,
    stats,
    loading,
    createWork,
    updateWork,
    deleteWork,
    toggleWorkComplete,
    createRoutine,
    updateRoutine,
    deleteRoutine,
    completeRoutineOccurrence,
    uncompleteRoutineOccurrence,
    getLocalDateString,
    getWeekdayIndex,
    isRoutineScheduledForWeekday
  } = useGoalTracker();

  // Today's date representations
  const todayString = getLocalDateString(); // YYYY-MM-DD
  const todayWeekdayIndex = getWeekdayIndex(todayString); // 0 (Sun) - 6 (Sat)
  const todayWeekdayName = WEEKDAY_NAMES[todayWeekdayIndex];

  // In-flight completing item tracking to prevent duplicate actions
  const [inFlightIds, setInFlightIds] = useState<Set<string>>(new Set());
  
  // Dashboard level error message (if any action fails)
  const [actionError, setActionError] = useState<string | null>(null);

  // Work Modal state (Create / Edit)
  const [isWorkModalOpen, setIsWorkModalOpen] = useState(false);
  const [workToEdit, setWorkToEdit] = useState<Work | null>(null);

  // Routine Modal state (Create / Edit)
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const [routineToEdit, setRoutineToEdit] = useState<Routine | null>(null);

  // Confirm Delete Modals state
  const [workToDelete, setWorkToDelete] = useState<Work | null>(null);
  const [isDeletingWork, setIsDeletingWork] = useState(false);

  const [routineToDelete, setRoutineToDelete] = useState<Routine | null>(null);
  const [isDeletingRoutine, setIsDeletingRoutine] = useState(false);

  // Viewport-centered completion overlay state
  const [overlayState, setOverlayState] = useState<{
    isOpen: boolean;
    title: string;
    word?: string;
    emoji?: string;
    itemType: 'work' | 'routine';
  }>({
    isOpen: false,
    title: '',
    word: 'COMPLETED',
    emoji: '',
    itemType: 'routine'
  });

  // Dynamic greeting based on current local hour
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const displayName = profile?.name?.trim() || user?.displayName?.trim() || 'Operator';

  // Helper to format "HH:MM" 24h into "HH:MM AM/PM"
  const formatDisplayTime = (timeStr?: string | null) => {
    if (!timeStr) return null;
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10);
    const m = mStr || '00';
    if (isNaN(h)) return null;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
  };

  // =========================================================================
  // WORKS DATA SELECTION (Module 1 Data Layer)
  // =========================================================================
  const activeWorks = useMemo(() => {
    return works.filter((w) => w.active !== false);
  }, [works]);

  const completedWorksCount = useMemo(() => {
    return activeWorks.filter((w) => w.completed).length;
  }, [activeWorks]);

  // =========================================================================
  // ROUTINES DATA SELECTION (Module 1 Data Layer + Scheduled for Today + Sorted by Time)
  // =========================================================================
  const activeRoutines = useMemo(() => {
    return routines.filter((r) => r.active !== false && r.isActive !== false);
  }, [routines]);

  // Routines scheduled strictly for today's weekday based on `days` array, sorted by scheduled time
  const todayRoutines = useMemo(() => {
    return activeRoutines
      .filter((r) => isRoutineScheduledForWeekday(r, todayWeekdayIndex))
      .sort((a, b) => {
        const timeA = (a.time || a.reminderTime || '99:99').trim();
        const timeB = (b.time || b.reminderTime || '99:99').trim();
        return timeA.localeCompare(timeB);
      });
  }, [activeRoutines, todayWeekdayIndex, isRoutineScheduledForWeekday]);

  // Check completions for today
  const completedRoutineIdsToday = useMemo(() => {
    const ids = new Set<string>();
    completions.forEach((c) => {
      if ((c.date === todayString || c.dateString === todayString) && c.itemType !== 'work') {
        const id = c.itemId || c.routineId;
        if (id) ids.add(id);
      }
    });
    return ids;
  }, [completions, todayString]);

  const completedRoutinesCount = useMemo(() => {
    return todayRoutines.filter((r) => completedRoutineIdsToday.has(r.id)).length;
  }, [todayRoutines, completedRoutineIdsToday]);

  // Combined totals for overview
  const totalTasksToday = activeWorks.length + todayRoutines.length;
  const totalCompletedToday = completedWorksCount + completedRoutinesCount;
  const totalRemainingToday = Math.max(0, totalTasksToday - totalCompletedToday);

  // =========================================================================
  // WORK CRUD HANDLERS
  // =========================================================================
  const handleOpenCreateWork = () => {
    setWorkToEdit(null);
    setIsWorkModalOpen(true);
    setActionError(null);
  };

  const handleOpenEditWork = (work: Work, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setWorkToEdit(work);
    setIsWorkModalOpen(true);
    setActionError(null);
  };

  const handleWorkFormSubmit = async (workData: { title: string; description?: string }) => {
    if (workToEdit) {
      await updateWork(workToEdit.id, {
        title: workData.title,
        description: workData.description || ''
      });
    } else {
      await createWork(workData);
    }
  };

  const handleOpenDeleteWork = (work: Work, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setWorkToDelete(work);
    setActionError(null);
  };

  const handleConfirmDeleteWork = async () => {
    if (!workToDelete) return;
    setIsDeletingWork(true);
    setActionError(null);

    try {
      await deleteWork(workToDelete.id);
      setWorkToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete work', err);
      setActionError(err?.message || 'Could not delete work. Please try again.');
    } finally {
      setIsDeletingWork(false);
    }
  };

  // =========================================================================
  // ROUTINE CRUD HANDLERS (Module 4)
  // =========================================================================
  const handleOpenCreateRoutine = () => {
    setRoutineToEdit(null);
    setIsRoutineModalOpen(true);
    setActionError(null);
  };

  const handleOpenEditRoutine = (routine: Routine, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRoutineToEdit(routine);
    setIsRoutineModalOpen(true);
    setActionError(null);
  };

  const handleRoutineFormSubmit = async (routineData: {
    title: string;
    note?: string;
    time: string;
    days: CanonicalWeekday[];
    category?: GoalCategory;
    emoji?: string;
  }) => {
    if (routineToEdit) {
      await updateRoutine(routineToEdit.id, {
        title: routineData.title,
        note: routineData.note || '',
        time: routineData.time,
        days: routineData.days,
        category: routineData.category,
        emoji: routineData.emoji
      });
    } else {
      await createRoutine({
        title: routineData.title,
        note: routineData.note || '',
        time: routineData.time,
        days: routineData.days,
        category: routineData.category,
        emoji: routineData.emoji
      });
    }
  };

  const handleOpenDeleteRoutine = (routine: Routine, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRoutineToDelete(routine);
    setActionError(null);
  };

  const handleConfirmDeleteRoutine = async () => {
    if (!routineToDelete) return;
    setIsDeletingRoutine(true);
    setActionError(null);

    try {
      await deleteRoutine(routineToDelete.id);
      setRoutineToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete routine', err);
      setActionError(err?.message || 'Could not delete routine. Please try again.');
    } finally {
      setIsDeletingRoutine(false);
    }
  };

  // Handle Work Completion (Permanent completion - cannot be unticked/uncompleted)
  const handleToggleWork = async (work: Work) => {
    if (work.completed) return;
    if (inFlightIds.has(work.id)) return;

    setInFlightIds((prev) => new Set(prev).add(work.id));
    setActionError(null);

    try {
      const res = await completeWork(work.id);

      // Trigger viewport-centered celebration overlay
      setOverlayState({
        isOpen: true,
        title: work.title,
        word: res?.word || 'EXECUTED',
        emoji: '💼',
        itemType: 'work'
      });
    } catch (err: any) {
      console.error('Failed to complete work', err);
      setActionError('Could not update work status. Please try again.');
    } finally {
      setInFlightIds((prev) => {
        const next = new Set(prev);
        next.delete(work.id);
        return next;
      });
    }
  };

  // Handle Routine Completion Toggle
  const handleToggleRoutine = async (routine: Routine) => {
    if (inFlightIds.has(routine.id)) return;

    setInFlightIds((prev) => new Set(prev).add(routine.id));
    setActionError(null);

    const isCompleted = completedRoutineIdsToday.has(routine.id);

    try {
      if (isCompleted) {
        await uncompleteRoutineOccurrence(routine.id, todayString);
      } else {
        const res = await completeRoutineOccurrence(routine.id, todayString);
        // Trigger viewport-centered celebration overlay
        setOverlayState({
          isOpen: true,
          title: routine.title || routine.name || 'Routine',
          word: res?.word || 'DISCIPLINED',
          emoji: routine.emoji || '🎯',
          itemType: 'routine'
        });
      }
    } catch (err: any) {
      console.error('Failed to toggle routine completion', err);
      setActionError('Could not update routine completion. Please try again.');
    } finally {
      setInFlightIds((prev) => {
        const next = new Set(prev);
        next.delete(routine.id);
        return next;
      });
    }
  };

  // Format full friendly date
  const formattedFullDate = useMemo(() => {
    try {
      const parts = todayString.split('-').map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return todayString;
    }
  }, [todayString]);

  // Loading State
  if (loading && works.length === 0 && routines.length === 0) {
    return (
      <div 
        id="dashboard-loading-state"
        className="w-full py-24 flex flex-col items-center justify-center space-y-4"
      >
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase">
          LOADING DASHBOARD...
        </p>
      </div>
    );
  }

  return (
    <div id="main-dashboard-page" className="w-full space-y-8 pb-8">
      {/* 
        VIEWPORT-CENTERED CELEBRATION OVERLAY
        Rendered via createPortal to document.body.
        Guaranteed to center on screen viewport regardless of scroll position or card coordinates.
      */}
      <GoalCompletedOverlay
        isOpen={overlayState.isOpen}
        title={overlayState.title}
        word={overlayState.word}
        emoji={overlayState.emoji}
        itemType={overlayState.itemType}
        onClose={() => setOverlayState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* WORK CREATION / EDIT MODAL */}
      <WorkModal
        isOpen={isWorkModalOpen}
        onClose={() => {
          setIsWorkModalOpen(false);
          setWorkToEdit(null);
        }}
        onSubmit={handleWorkFormSubmit}
        workToEdit={workToEdit}
      />

      {/* ROUTINE CREATION / EDIT MODAL */}
      <RoutineModal
        isOpen={isRoutineModalOpen}
        onClose={() => {
          setIsRoutineModalOpen(false);
          setRoutineToEdit(null);
        }}
        onSubmit={handleRoutineFormSubmit}
        routineToEdit={routineToEdit}
      />

      {/* CONFIRM DELETE WORK MODAL */}
      <ConfirmDeleteModal
        isOpen={!!workToDelete}
        onClose={() => !isDeletingWork && setWorkToDelete(null)}
        onConfirm={handleConfirmDeleteWork}
        title="Delete Work"
        itemName={workToDelete?.title || 'this work'}
        isDeleting={isDeletingWork}
      />

      {/* CONFIRM DELETE ROUTINE MODAL */}
      <ConfirmDeleteModal
        isOpen={!!routineToDelete}
        onClose={() => !isDeletingRoutine && setRoutineToDelete(null)}
        onConfirm={handleConfirmDeleteRoutine}
        title="Delete Routine"
        itemName={routineToDelete?.title || routineToDelete?.name || 'this routine'}
        isDeleting={isDeletingRoutine}
      />

      {/* ACTION ERROR BANNER */}
      {actionError && (
        <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl flex items-center justify-between text-xs text-red-200">
          <div className="flex items-center space-x-2">
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button 
            onClick={() => setActionError(null)}
            className="p-1 text-red-400 hover:text-red-200 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 1. HEADER / GREETING SECTION */}
      {/* ===================================================================== */}
      <header id="dashboard-header" className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
            <CalendarDays size={12} className="text-zinc-400" />
            <span>{formattedFullDate}</span>
          </div>
          {stats?.currentStreak > 0 && (
            <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-zinc-300">
              <span className="text-white font-semibold">🔥 {stats.currentStreak}d</span>
              <span className="text-zinc-500 uppercase text-[8px]">streak</span>
            </div>
          )}
        </div>
        <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-white font-display">
          {greeting}, <span className="font-semibold text-white">{displayName}</span>.
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 font-light">
          {totalRemainingToday > 0
            ? `You have ${totalRemainingToday} ${totalRemainingToday === 1 ? 'task' : 'tasks'} remaining today.`
            : totalTasksToday > 0
              ? `You've completed all tasks for today. Outstanding execution.`
              : 'Add works or schedule routines to build your daily system.'}
        </p>
      </header>

      {/* ===================================================================== */}
      {/* 2. TODAY'S OVERVIEW & WEEKLY PROGRESS SECTION */}
      {/* ===================================================================== */}
      <section id="today-overview-section" aria-label="Today's Overview" className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {/* Works Status Card */}
          <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-mono">
                TODAY'S WORKS
              </span>
              <Briefcase size={14} className="text-zinc-400" />
            </div>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-2xl sm:text-3xl font-light font-display text-white">
                {completedWorksCount}
              </span>
              <span className="text-xs font-mono text-zinc-500">
                / {activeWorks.length}
              </span>
            </div>
            <div className="mt-3 w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-white h-full transition-all duration-500 rounded-full"
                style={{ 
                  width: `${activeWorks.length > 0 ? (completedWorksCount / activeWorks.length) * 100 : 0}%` 
                }}
              />
            </div>
          </div>

          {/* Routines Status Card */}
          <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-mono">
                ROUTINES ({todayWeekdayName.toUpperCase().slice(0, 3)})
              </span>
              <Clock size={14} className="text-zinc-400" />
            </div>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-2xl sm:text-3xl font-light font-display text-white">
                {completedRoutinesCount}
              </span>
              <span className="text-xs font-mono text-zinc-500">
                / {todayRoutines.length}
              </span>
            </div>
            <div className="mt-3 w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-white h-full transition-all duration-500 rounded-full"
                style={{ 
                  width: `${todayRoutines.length > 0 ? (completedRoutinesCount / todayRoutines.length) * 100 : 0}%` 
                }}
              />
            </div>
          </div>
        </div>

        {/* Weekly Progress & Performance Bar */}
        {(stats?.expectedWeeklyOccurrences ?? 0) > 0 && (
          <div className="p-3 px-4 rounded-xl bg-zinc-900/30 border border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest">WEEKLY PROGRESS</span>
              <span className="text-white font-medium">{stats.overallWeeklyProgress ?? 0}%</span>
              <span className="text-zinc-600 text-[10px]">
                ({stats.completedWeeklyOccurrences ?? 0}/{stats.expectedWeeklyOccurrences ?? 0} done)
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-zinc-500 text-[10px]">CONSISTENCY: <strong className="text-white font-semibold">{stats.completionRate ?? 0}%</strong></span>
              <span className="px-2 py-0.5 rounded-full bg-white/5 text-[9px] text-zinc-400 border border-white/10 uppercase">
                {stats.performanceLevel ?? 'Starting'}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* 3. TODAY'S WORKS SECTION */}
      {/* ===================================================================== */}
      <section id="today-works-section" className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center space-x-2">
            <Briefcase size={14} className="text-zinc-400" />
            <h2 className="text-xs font-mono tracking-widest text-zinc-400 uppercase font-semibold">
              TODAY'S WORKS
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
              {activeWorks.length}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {activeWorks.length > 0 && (
              <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">
                {completedWorksCount} OF {activeWorks.length} DONE
              </span>
            )}
            <button
              type="button"
              id="add-work-header-button"
              onClick={handleOpenCreateWork}
              className="px-3 py-1.5 rounded-xl bg-white text-black font-mono text-[11px] font-semibold tracking-wider hover:bg-zinc-200 transition-all cursor-pointer flex items-center space-x-1 shadow-sm active:scale-95"
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>NEW WORK</span>
            </button>
          </div>
        </div>

        {activeWorks.length === 0 ? (
          <div className="p-8 bg-zinc-900/20 border border-white/5 rounded-2xl text-center space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-850 border border-white/10 flex items-center justify-center mx-auto text-zinc-400">
              <Briefcase size={18} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-mono text-zinc-300 uppercase tracking-wider">
                No works active
              </p>
              <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                Works are one-off tasks, strategic deliverables, and projects you actively track.
              </p>
            </div>
            <button
              type="button"
              id="add-first-work-button"
              onClick={handleOpenCreateWork}
              className="mt-2 px-4 py-2 rounded-xl bg-zinc-850 hover:bg-zinc-800 border border-white/10 text-xs font-mono tracking-wider text-white inline-flex items-center space-x-1.5 transition-all cursor-pointer active-press shadow-sm"
            >
              <Plus size={14} />
              <span>ADD FIRST WORK</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeWorks.map((work) => {
              const isDone = !!work.completed;
              const isInFlight = inFlightIds.has(work.id);

              return (
                <div
                  key={work.id}
                  id={`work-card-${work.id}`}
                  onClick={() => !isDone && handleToggleWork(work)}
                  className={`group relative w-full bg-zinc-900/40 border rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3 transition-all select-none ${
                    isDone 
                      ? 'border-white/5 bg-zinc-950/40 opacity-75 cursor-default' 
                      : 'border-white/10 hover:border-white/20 hover:bg-zinc-900/70 shadow-sm cursor-pointer active:scale-[0.99]'
                  }`}
                >
                  {/* Left content: Title & optional description */}
                  <div className="min-w-0 flex-1 pr-2">
                    <h3 
                      className={`text-sm font-medium tracking-tight break-words transition-colors ${
                        isDone 
                          ? 'line-through text-zinc-500' 
                          : 'text-white group-hover:text-white'
                      }`}
                    >
                      {work.title}
                    </h3>
                    {work.description && (
                      <p 
                        className={`text-xs mt-1 break-words font-light leading-relaxed ${
                          isDone ? 'text-zinc-600 line-through' : 'text-zinc-400'
                        }`}
                      >
                        {work.description}
                      </p>
                    )}
                  </div>

                  {/* Right side controls: Action buttons & Completion Status */}
                  <div className="flex items-center space-x-2 shrink-0">
                    {/* Action buttons (Edit & Delete) */}
                    <div className="flex items-center space-x-1 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        id={`edit-work-${work.id}`}
                        onClick={(e) => handleOpenEditWork(work, e)}
                        title="Edit Work"
                        aria-label={`Edit work ${work.title}`}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        <Pencil size={14} />
                      </button>

                      <button
                        type="button"
                        id={`delete-work-${work.id}`}
                        onClick={(e) => handleOpenDeleteWork(work, e)}
                        title="Delete Work"
                        aria-label={`Delete work ${work.title}`}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Completion Status: Final badge if completed (no uncomplete action), or interactive complete button if pending */}
                    {isDone ? (
                      <div
                        id={`work-completed-badge-${work.id}`}
                        title="Work Completed"
                        aria-label={`Work "${work.title}" is completed`}
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-white text-black border border-white shadow-sm cursor-default select-none"
                      >
                        <Check size={16} strokeWidth={3} />
                      </div>
                    ) : (
                      <button
                        type="button"
                        id={`toggle-work-${work.id}`}
                        disabled={isInFlight}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleWork(work);
                        }}
                        aria-label={`Mark work "${work.title}" as complete`}
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 border border-white/20 text-transparent hover:border-white group-hover:bg-white/10 transition-all cursor-pointer"
                      >
                        {isInFlight ? (
                          <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* 4. TODAY'S ROUTINES SECTION */}
      {/* ===================================================================== */}
      <section id="today-routines-section" className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center space-x-2">
            <Clock size={14} className="text-zinc-400" />
            <h2 className="text-xs font-mono tracking-widest text-zinc-400 uppercase font-semibold">
              TODAY'S ROUTINES
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
              {todayRoutines.length}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {todayRoutines.length > 0 && (
              <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">
                {completedRoutinesCount} OF {todayRoutines.length} COMPLETED
              </span>
            )}
            <button
              type="button"
              id="add-routine-header-button"
              onClick={handleOpenCreateRoutine}
              className="px-3 py-1.5 rounded-xl bg-white text-black font-mono text-[11px] font-semibold tracking-wider hover:bg-zinc-200 transition-all cursor-pointer flex items-center space-x-1 shadow-sm active:scale-95"
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>NEW ROUTINE</span>
            </button>
          </div>
        </div>

        {activeRoutines.length === 0 ? (
          /* Case A: User has zero routines at all */
          <div className="p-8 bg-zinc-900/20 border border-white/5 rounded-2xl text-center space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-850 border border-white/10 flex items-center justify-center mx-auto text-zinc-400">
              <Clock size={18} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-mono text-zinc-300 uppercase tracking-wider">
                No routines calibrated yet
              </p>
              <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                Routines are recurring habits and disciplined practices scheduled for specific weekdays.
              </p>
            </div>
            <div className="flex items-center justify-center space-x-2 pt-1">
              <button
                type="button"
                id="add-first-routine-button"
                onClick={handleOpenCreateRoutine}
                className="px-4 py-2 rounded-xl bg-zinc-850 hover:bg-zinc-800 border border-white/10 text-xs font-mono tracking-wider text-white inline-flex items-center space-x-1.5 transition-all cursor-pointer active-press shadow-sm"
              >
                <Plus size={14} />
                <span>ADD FIRST ROUTINE</span>
              </button>
              {onNavigateToGoals && (
                <button
                  type="button"
                  onClick={onNavigateToGoals}
                  className="px-4 py-2 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 text-xs font-mono tracking-wider text-zinc-400 hover:text-white inline-flex items-center space-x-1 transition-all cursor-pointer"
                >
                  <span>ALL GOALS</span>
                  <ArrowRight size={12} />
                </button>
              )}
            </div>
          </div>
        ) : todayRoutines.length === 0 ? (
          /* Case B: Routines exist in system, but none scheduled for today's weekday */
          <div className="p-8 bg-zinc-900/20 border border-white/5 rounded-2xl text-center space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-850 border border-white/10 flex items-center justify-center mx-auto text-zinc-400">
              <CalendarDays size={18} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-mono text-zinc-300 uppercase tracking-wider">
                No routines scheduled for {todayWeekdayName}
              </p>
              <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                You have {activeRoutines.length} active {activeRoutines.length === 1 ? 'routine' : 'routines'} configured for other days of the week.
              </p>
            </div>
            <div className="flex items-center justify-center space-x-2 pt-1">
              <button
                type="button"
                id="add-routine-for-today-button"
                onClick={handleOpenCreateRoutine}
                className="px-4 py-2 rounded-xl bg-zinc-850 hover:bg-zinc-800 border border-white/10 text-xs font-mono tracking-wider text-white inline-flex items-center space-x-1.5 transition-all cursor-pointer active-press shadow-sm"
              >
                <Plus size={14} />
                <span>NEW ROUTINE</span>
              </button>
              {onNavigateToGoals && (
                <button
                  type="button"
                  onClick={onNavigateToGoals}
                  className="px-4 py-2 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 text-xs font-mono tracking-wider text-zinc-400 hover:text-white inline-flex items-center space-x-1 transition-all cursor-pointer"
                >
                  <span>VIEW ALL</span>
                  <ArrowRight size={12} />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Case C: Render scheduled routines */
          <div className="space-y-2.5">
            {todayRoutines.map((routine) => {
              const isCompletedToday = completedRoutineIdsToday.has(routine.id);
              const isInFlight = inFlightIds.has(routine.id);
              const routineTitle = routine.title || routine.name || 'Routine';
              const routineNote = routine.note || routine.notes;
              const routineTime = routine.time || routine.reminderTime;

              return (
                <div
                  key={routine.id}
                  id={`routine-card-${routine.id}`}
                  onClick={() => handleToggleRoutine(routine)}
                  className={`group relative w-full bg-zinc-900/40 border rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3 transition-all cursor-pointer select-none active:scale-[0.99] ${
                    isCompletedToday 
                      ? 'border-white/5 bg-zinc-950/40 opacity-75' 
                      : 'border-white/10 hover:border-white/20 hover:bg-zinc-900/70 shadow-sm'
                  }`}
                >
                  {/* Left: Emoji badge & Metadata */}
                  <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-zinc-850 border border-white/5 flex items-center justify-center text-lg select-none shrink-0 group-hover:scale-105 transition-transform">
                      {routine.emoji || '🎯'}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <h3 
                          className={`text-sm font-semibold tracking-tight truncate ${
                            isCompletedToday 
                              ? 'line-through text-zinc-500' 
                              : 'text-white group-hover:text-white'
                          }`}
                        >
                          {routineTitle}
                        </h3>
                      </div>

                      {/* Secondary Metadata Info (Time, Category, Note) */}
                      <div className="flex items-center space-x-2 text-[10px] text-zinc-500 font-mono uppercase mt-0.5 flex-wrap gap-y-0.5">
                        {routine.category && (
                          <span className="text-zinc-400 font-medium">
                            {routine.category}
                          </span>
                        )}

                        {routineTime && (
                          <>
                            {routine.category && <span>•</span>}
                            <div className="flex items-center space-x-1 text-zinc-300 font-medium">
                              <Clock size={10} />
                              <span>{formatDisplayTime(routineTime)}</span>
                            </div>
                          </>
                        )}

                        {routineNote && (
                          <>
                            <span>•</span>
                            <span 
                              className="text-zinc-400 normal-case italic truncate max-w-[140px] sm:max-w-[220px]" 
                              title={routineNote}
                            >
                              "{routineNote}"
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side controls: Action buttons & Completion Checkbox */}
                  <div className="flex items-center space-x-2 shrink-0">
                    {/* Action buttons (Edit & Delete) */}
                    <div className="flex items-center space-x-1 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        id={`edit-routine-${routine.id}`}
                        onClick={(e) => handleOpenEditRoutine(routine, e)}
                        title="Edit Routine"
                        aria-label={`Edit routine ${routineTitle}`}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        <Pencil size={14} />
                      </button>

                      <button
                        type="button"
                        id={`delete-routine-${routine.id}`}
                        onClick={(e) => handleOpenDeleteRoutine(routine, e)}
                        title="Delete Routine"
                        aria-label={`Delete routine ${routineTitle}`}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Completion Toggle Control (accessible >=44px touch) */}
                    <button
                      type="button"
                      id={`toggle-routine-${routine.id}`}
                      disabled={isInFlight}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleRoutine(routine);
                      }}
                      aria-label={`Mark routine "${routineTitle}" as ${isCompletedToday ? 'incomplete' : 'complete'}`}
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border transition-all cursor-pointer ${
                        isCompletedToday
                          ? 'bg-white text-black border-white shadow-sm'
                          : 'border-white/20 text-transparent hover:border-white group-hover:bg-white/10'
                      }`}
                    >
                      {isInFlight ? (
                        <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      ) : isCompletedToday ? (
                        <Check size={16} strokeWidth={3} />
                      ) : (
                        <div className="w-2 h-2 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
