import React, { useState } from 'react';
import { useGoalTracker } from '../context/GoalContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { RoutineModal } from '../components/RoutineModal';
import { EmptyState } from '../components/EmptyState';
import { Trash2, Clock, Zap, Sliders, Edit3, Plus, X, Check } from 'lucide-react';
import { GoalCategory, Routine, CanonicalWeekday } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ToastMessage, ToastContainer } from '../components/Toast';

const CATEGORY_EMOJIS: { [key in GoalCategory]: string } = {
  Fitness: '🏋️',
  Study: '📚',
  Reading: '📖',
  Work: '💻',
  Health: '🍎',
  Custom: '🎯'
};

// Weekdays ordered Monday through Sunday (M T W T F S S)
const WEEKDAYS = [
  { label: 'M', value: 1, name: 'Monday' },
  { label: 'T', value: 2, name: 'Tuesday' },
  { label: 'W', value: 3, name: 'Wednesday' },
  { label: 'T', value: 4, name: 'Thursday' },
  { label: 'F', value: 5, name: 'Friday' },
  { label: 'S', value: 6, name: 'Saturday' },
  { label: 'S', value: 0, name: 'Sunday' }
];

// Quick templates for instant 1-tap routine creation
const ROUTINE_TEMPLATES: Array<{
  name: string;
  category: GoalCategory;
  emoji: string;
  duration: number;
}> = [
  { name: 'Workout', category: 'Fitness', emoji: '🏋️', duration: 45 },
  { name: 'Study', category: 'Study', emoji: '📚', duration: 30 },
  { name: 'Reading', category: 'Reading', emoji: '📖', duration: 20 },
  { name: 'Meditation', category: 'Health', emoji: '🧘', duration: 15 },
  { name: 'Coding', category: 'Work', emoji: '💻', duration: 60 },
  { name: 'Hydration', category: 'Health', emoji: '💧', duration: 5 }
];

// Motivational note presets for quick 1-tap addition
const NOTE_PRESETS = [
  'No excuses.',
  'Don’t skip.',
  'Deep work only.',
  'Focus on form.',
  'One step at a time.',
  'Finish what you started.',
  'Phone away.',
  'Stay disciplined.'
];

// Common time presets for time picker
const TIME_PRESETS = [
  { label: '06:00 AM', value: '06:00' },
  { label: '07:00 AM', value: '07:00' },
  { label: '08:00 AM', value: '08:00' },
  { label: '09:00 AM', value: '09:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '06:00 PM', value: '18:00' },
  { label: '08:00 PM', value: '20:00' },
  { label: '09:30 PM', value: '21:30' }
];

const DURATION_PRESETS = [5, 15, 20, 30, 45, 60, 90, 120];

// Helper to format "HH:MM" (24h) to "HH:MM AM/PM" or fallback to "SET TIME"
function formatTime12h(timeStr?: string | null): string {
  if (!timeStr) return 'SET TIME';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr || '00';
  if (isNaN(h)) return 'SET TIME';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
}

// Smart natural language parser for Quick Add
function parseQuickRoutine(input: string) {
  let title = input.trim();
  let reminderTime: string | null = null;
  let duration = 30;
  let category: GoalCategory = 'Custom';
  let emoji = '🎯';
  let repeatSchedule: number[] = []; // Default to empty (user chooses), or parsed from input

  // 1. Check for repeat schedule patterns (e.g. "Daily", "Every day", "Everyday", "Weekdays", "Weekends")
  if (/\b(?:every\s*day|daily|all\s*days|7\s*days)\b/i.test(title)) {
    repeatSchedule = [0, 1, 2, 3, 4, 5, 6];
  } else if (/\b(?:weekdays|mon-fri|monday to friday)\b/i.test(title)) {
    repeatSchedule = [1, 2, 3, 4, 5];
  } else if (/\b(?:weekends|sat-sun|saturday and sunday)\b/i.test(title)) {
    repeatSchedule = [0, 6];
  }

  // 2. Check for time pattern (e.g. "at 6 PM", "at 18:00", "at 7:30 am", "6pm", "6 am")
  const timeRegex = /(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?\b/i;
  const timeMatch = title.match(timeRegex);
  if (timeMatch && (timeMatch[3] || timeMatch[2] || title.toLowerCase().includes('at '))) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const modifier = timeMatch[3]?.toLowerCase();

    if (modifier === 'pm' && hours < 12) hours += 12;
    if (modifier === 'am' && hours === 12) hours = 0;

    if (hours >= 0 && hours <= 23) {
      reminderTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      title = title.replace(timeMatch[0], '').replace(/\s{2,}/g, ' ').trim();
    }
  }

  // 3. Check for duration pattern (e.g. "for 45m", "for 45 mins", "45 min", "1 hour", "2h")
  const durRegex = /(?:for\s+)?(\d+)\s*(?:min|mins|minutes|m|hour|hours|h)\b/i;
  const durMatch = title.match(durRegex);
  if (durMatch) {
    let parsedMinutes = parseInt(durMatch[1], 10);
    if (durMatch[0].toLowerCase().includes('hour') || durMatch[0].toLowerCase().includes('h')) {
      parsedMinutes = parsedMinutes * 60;
    }
    if (parsedMinutes > 0 && parsedMinutes <= 480) {
      duration = parsedMinutes;
      title = title.replace(durMatch[0], '').replace(/\s{2,}/g, ' ').trim();
    }
  }

  // Clean trailing punctuation
  title = title.replace(/^[-–—:,.\s]+|[-–—:,.\s]+$/g, '');
  if (!title) title = input.trim();

  // 4. Infer category & emoji from keywords
  const lower = title.toLowerCase();
  if (/gym|workout|lift|run|cardio|pushup|training|exercise|fitness|stretch/i.test(lower)) {
    category = 'Fitness';
    emoji = '🏋️';
    if (!durMatch) duration = 45;
  } else if (/study|dsa|algo|math|exam|learn|class|course|read/i.test(lower)) {
    if (/read|book|novel/i.test(lower)) {
      category = 'Reading';
      emoji = '📖';
      if (!durMatch) duration = 20;
    } else {
      category = 'Study';
      emoji = '📚';
      if (!durMatch) duration = 30;
    }
  } else if (/code|coding|dev|program|bug|ship|feature|review/i.test(lower)) {
    category = 'Work';
    emoji = '💻';
    if (!durMatch) duration = 60;
  } else if (/meditate|meditation|breath|water|hydrate|sleep|walk|journal|health/i.test(lower)) {
    category = 'Health';
    emoji = /water|hydrate/i.test(lower) ? '💧' : '🧘';
    if (!durMatch) duration = /water|hydrate/i.test(lower) ? 5 : 15;
  }

  return { title, duration, reminderTime, category, emoji, repeatSchedule };
}

export const GoalsPage: React.FC = () => {
  const { 
    routines, 
    createRoutine, 
    updateRoutine, 
    deleteRoutine, 
    toggleGoalCompletion,
    isGoalCompletedOnDate,
    isRoutineScheduledForWeekday,
    getRoutineStreak,
    getLocalDateString,
    loading 
  } = useGoalTracker();
  
  const todayStr = getLocalDateString();
  const todayWeekday = new Date().getDay();
  const [quickInput, setQuickInput] = useState<string>('');
  const [isQuickAdding, setIsQuickAdding] = useState<boolean>(false);

  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState<boolean>(false);
  const [routineToEdit, setRoutineToEdit] = useState<Routine | null>(null);

  // Interactive Routine Modals
  // Time Picker Modal
  const [timePickerTarget, setTimePickerTarget] = useState<{
    routineId: string;
    routineName: string;
    currentTime: string | null;
  } | null>(null);
  const [selectedTimeInput, setSelectedTimeInput] = useState<string>('07:00');

  // Duration Picker Modal
  const [durationPickerTarget, setDurationPickerTarget] = useState<{
    routineId: string;
    routineName: string;
    currentDuration: number;
  } | null>(null);
  const [selectedDurationInput, setSelectedDurationInput] = useState<number>(30);

  // Note Modal
  const [noteModalTarget, setNoteModalTarget] = useState<{
    routineId: string;
    routineName: string;
    currentNotes: string;
  } | null>(null);
  const [noteInput, setNoteInput] = useState<string>('');

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // Fast Quick Add execution
  const handleQuickAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickInput.trim()) return;

    setIsQuickAdding(true);
    try {
      const parsed = parseQuickRoutine(quickInput);
      const scheduledDays: CanonicalWeekday[] = (parsed.repeatSchedule && parsed.repeatSchedule.length > 0)
        ? (parsed.repeatSchedule.map(i => (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as CanonicalWeekday[])[i]))
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

      await createRoutine({
        title: parsed.title,
        name: parsed.title,
        category: parsed.category,
        emoji: parsed.emoji,
        duration: parsed.duration,
        time: parsed.reminderTime || '07:00',
        days: scheduledDays,
        note: ''
      });
      showToast(`Routine "${parsed.title}" created!`, 'success');
      setQuickInput('');
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to create routine.', 'error');
    } finally {
      setIsQuickAdding(false);
    }
  };

  // Instant 1-tap template creation
  const handleCreateFromTemplate = async (template: typeof ROUTINE_TEMPLATES[0]) => {
    try {
      await createRoutine({
        title: template.name,
        name: template.name,
        category: template.category,
        emoji: template.emoji,
        duration: template.duration,
        time: '07:00',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        note: ''
      });
      showToast(`${template.emoji} ${template.name} routine created!`, 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to create template routine.', 'error');
    }
  };

  const handleRoutineModalSubmit = async (data: {
    title: string;
    note?: string;
    time: string;
    days: CanonicalWeekday[];
    category?: GoalCategory;
    emoji?: string;
  }) => {
    if (routineToEdit) {
      await updateRoutine(routineToEdit.id, data);
      showToast(`Routine "${data.title}" updated!`, 'success');
    } else {
      await createRoutine(data);
      showToast(`Routine "${data.title}" calibrated!`, 'success');
    }
  };

  // Day toggle directly on a routine card
  const handleToggleDay = async (routine: Routine, dayValue: number) => {
    const allDays = [0, 1, 2, 3, 4, 5, 6];
    const currentlyScheduledDays = allDays.filter(d => isRoutineScheduledForWeekday(routine, d));
    const isSelected = currentlyScheduledDays.includes(dayValue);
    const newSchedule = isSelected
      ? currentlyScheduledDays.filter(d => d !== dayValue)
      : [...currentlyScheduledDays, dayValue].sort((a, b) => a - b);

    try {
      await updateRoutine(routine.id, { repeatSchedule: newSchedule });
    } catch (err) {
      console.error(err);
      showToast('Failed to update schedule.', 'error');
    }
  };

  // Open Time Picker Modal for routine
  const openTimePicker = (routine: Routine) => {
    setTimePickerTarget({
      routineId: routine.id,
      routineName: routine.name,
      currentTime: routine.reminderTime || null
    });
    setSelectedTimeInput(routine.reminderTime || '07:00');
  };

  // Save selected reminder time
  const handleSaveTime = async (timeValue: string | null) => {
    if (!timePickerTarget) return;
    try {
      await updateRoutine(timePickerTarget.routineId, { reminderTime: timeValue });
      setTimePickerTarget(null);
      showToast(timeValue ? `Reminder set to ${formatTime12h(timeValue)}` : 'Reminder cleared', 'info');
    } catch (err) {
      console.error(err);
      showToast('Failed to update reminder time.', 'error');
    }
  };

  // Open Duration Picker Modal for routine
  const openDurationPicker = (routine: Routine) => {
    setDurationPickerTarget({
      routineId: routine.id,
      routineName: routine.name,
      currentDuration: routine.duration || 30
    });
    setSelectedDurationInput(routine.duration || 30);
  };

  // Save selected duration
  const handleSaveDuration = async (durationValue: number) => {
    if (!durationPickerTarget) return;
    try {
      await updateRoutine(durationPickerTarget.routineId, { duration: durationValue });
      setDurationPickerTarget(null);
      showToast(`Duration updated to ${durationValue} min`, 'info');
    } catch (err) {
      console.error(err);
      showToast('Failed to update duration.', 'error');
    }
  };

  // Open Note Modal for routine
  const openNoteModal = (routine: Routine) => {
    setNoteModalTarget({
      routineId: routine.id,
      routineName: routine.name,
      currentNotes: routine.notes || ''
    });
    setNoteInput(routine.notes || '');
  };

  // Save note
  const handleSaveNote = async (noteValue: string) => {
    if (!noteModalTarget) return;
    try {
      await updateRoutine(noteModalTarget.routineId, { notes: noteValue.trim() });
      setNoteModalTarget(null);
      showToast(noteValue.trim() ? 'Note saved!' : 'Note removed', 'info');
    } catch (err) {
      console.error(err);
      showToast('Failed to update note.', 'error');
    }
  };

  const handleDelete = async (routineId: string, routineName: string) => {
    try {
      await deleteRoutine(routineId);
      showToast(`Routine "${routineName}" deleted.`, 'info');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete routine.', 'error');
    }
  };

  return (
    <div className="w-full space-y-6">
      <ToastContainer toasts={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

      {/* Header */}
      <div className="flex items-center justify-between font-mono border-b border-white/5 pb-4 mt-2">
        <div className="flex flex-col space-y-1">
          <span className="text-[10px] tracking-[0.2em] text-zinc-500 uppercase">CALIBRATE</span>
          <h1 className="text-xl font-bold tracking-tight text-white font-display">
            ALL ROUTINES
          </h1>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => {
            setRoutineToEdit(null);
            setIsRoutineModalOpen(true);
          }}
          className="flex items-center space-x-1.5 border-white/10 hover:border-white/30"
        >
          <Plus size={13} />
          <span>NEW ROUTINE</span>
        </Button>
      </div>

      {/* Quick Add Section */}
      <div className="bg-zinc-900/40 border border-white/5 rounded-[32px] p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap size={14} className="text-white animate-pulse" />
            <span className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase">
              QUICK ADD ROUTINE
            </span>
          </div>
          <span className="text-[9px] font-mono text-zinc-500 uppercase">
            INSTANT CALIBRATION
          </span>
        </div>

        {/* Quick Add Input Bar */}
        <form onSubmit={handleQuickAdd} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="e.g. Study DSA, Gym at 6 PM, Reading 20m..."
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              disabled={isQuickAdding}
              className="w-full px-4 py-3 bg-black/60 border border-white/10 rounded-2xl text-white placeholder-zinc-500 text-xs font-sans outline-none focus:border-white/30 transition-all"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!quickInput.trim() || isQuickAdding}
            className="px-5 font-mono text-xs tracking-wider shrink-0"
          >
            {isQuickAdding ? 'ADDING...' : 'ADD'}
          </Button>
        </form>

        {/* Fast Templates Strip */}
        <div className="space-y-2 pt-1 border-t border-white/5">
          <span className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase block">
            FAST TEMPLATES (1-TAP ACTIVATE)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {ROUTINE_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.name}
                type="button"
                onClick={() => handleCreateFromTemplate(tmpl)}
                className="px-3 py-1.5 bg-zinc-800/40 hover:bg-zinc-800 border border-white/5 hover:border-white/20 rounded-xl text-[11px] font-mono text-zinc-300 flex items-center space-x-1.5 transition-all cursor-pointer active-press"
              >
                <span>{tmpl.emoji}</span>
                <span>{tmpl.name}</span>
                <span className="text-zinc-500 text-[9px]">({tmpl.duration}m)</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Routine list */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 flex justify-center">
            <svg className="animate-spin h-5 w-5 text-neutral-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : routines.length === 0 ? (
          <EmptyState
            title="NO ROUTINES CALIBRATED"
            description="Consistency is built on routines. Use Quick Add, select a template, or create a custom routine."
            buttonText="NEW ROUTINE"
            onButtonClick={() => {
              setRoutineToEdit(null);
              setIsRoutineModalOpen(true);
            }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {routines.map((routine) => {
              const repeatList = Array.isArray(routine.repeatSchedule) ? routine.repeatSchedule : [];
              const isTimeConfigured = Boolean(routine.time || routine.reminderTime);
              const formattedTime = formatTime12h(routine.time || routine.reminderTime);
              const isScheduledToday = isRoutineScheduledForWeekday(routine, todayWeekday);
              const isCompletedToday = isGoalCompletedOnDate(routine.id, todayStr);
              const routineStreak = getRoutineStreak(routine);

              return (
                <motion.div
                  key={routine.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 bg-zinc-900/40 border border-white/5 rounded-[32px] flex flex-col space-y-4 shadow-lg"
                >
                  {/* Top Row: Title, Category, Streak, Today Status, Edit, Delete */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-zinc-850 border border-white/5 flex items-center justify-center text-xl select-none">
                        {routine.emoji || '🎯'}
                      </div>
                      
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold tracking-tight text-white truncate">
                          {routine.title || routine.name}
                        </h3>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <p className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
                            {routine.category}
                          </p>
                          {routineStreak.currentStreak > 0 && (
                            <span className="text-[10px] font-mono text-zinc-400 flex items-center space-x-0.5">
                              <span>•</span>
                              <span className="text-white font-medium">{routineStreak.currentStreak}d streak</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Today Status Pill / Toggle */}
                      {isScheduledToday ? (
                        <button
                          type="button"
                          onClick={() => toggleGoalCompletion(routine.id, todayStr)}
                          className={`
                            px-2.5 py-1 rounded-full text-[9px] font-mono flex items-center space-x-1.5 transition-all cursor-pointer active-press
                            ${isCompletedToday 
                              ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20' 
                              : 'bg-zinc-850 text-zinc-400 hover:text-white border border-white/5 hover:border-white/20'
                            }
                          `}
                          title={isCompletedToday ? "Completed for Today (Click to undo)" : "Pending for Today (Click to complete)"}
                        >
                          <span className={isCompletedToday ? "text-white" : "text-zinc-500"}>
                            {isCompletedToday ? '✓' : '○'}
                          </span>
                          <span>{isCompletedToday ? 'TODAY DONE' : 'TODAY PENDING'}</span>
                        </button>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-zinc-900/60 text-zinc-500 border border-white/5 text-[9px] font-mono uppercase">
                          REST TODAY
                        </span>
                      )}

                      {/* Edit Routine Button */}
                      <button
                        onClick={() => {
                          setRoutineToEdit(routine);
                          setIsRoutineModalOpen(true);
                        }}
                        className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800/40 rounded-full transition-all outline-none cursor-pointer active-press"
                        title="Edit Routine"
                      >
                        <Edit3 size={13} />
                      </button>

                      {/* Delete Routine Button */}
                      <button
                        onClick={() => handleDelete(routine.id, routine.title || routine.name || 'Routine')}
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800/40 rounded-full transition-all outline-none cursor-pointer active-press"
                        title="Delete Routine"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Mid Row: Interactive Reminder Time & Duration Controls */}
                  <div className="grid grid-cols-2 gap-2 border-t border-b border-white/5 py-3 font-mono text-[10px]">
                    {/* Reminder Button */}
                    <button
                      type="button"
                      onClick={() => openTimePicker(routine)}
                      className={`
                        px-3 py-2 rounded-xl flex items-center space-x-2 transition-all cursor-pointer text-left active-press
                        ${isTimeConfigured 
                          ? 'bg-zinc-850/60 hover:bg-zinc-800/80 border border-white/5 hover:border-white/20 text-zinc-300' 
                          : 'bg-zinc-900/60 hover:bg-zinc-850 border border-dashed border-white/10 hover:border-white/30 text-zinc-400'
                        }
                      `}
                    >
                      <Clock size={12} className={isTimeConfigured ? 'text-white' : 'text-zinc-500'} />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[8px] text-zinc-500 uppercase tracking-widest">REMINDER</span>
                        <span className={`truncate font-medium ${isTimeConfigured ? 'text-white' : 'text-zinc-400'}`}>
                          {formattedTime}
                        </span>
                      </div>
                    </button>

                    {/* Duration Button */}
                    <button
                      type="button"
                      onClick={() => openDurationPicker(routine)}
                      className="px-3 py-2 bg-zinc-850/60 hover:bg-zinc-800/80 border border-white/5 hover:border-white/20 rounded-xl flex items-center space-x-2 transition-all cursor-pointer text-left active-press text-zinc-300"
                    >
                      <Clock size={12} className="text-zinc-400" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[8px] text-zinc-500 uppercase tracking-widest">DURATION</span>
                        <span className="text-white font-medium truncate">
                          {routine.duration || 30} MIN
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Alarm-Style Weekday Schedule: M T W T F S S */}
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
                        REPEAT SCHEDULE
                      </span>
                      {WEEKDAYS.every(day => !isRoutineScheduledForWeekday(routine, day.value)) ? (
                        <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                          SET SCHEDULE
                        </span>
                      ) : WEEKDAYS.every(day => isRoutineScheduledForWeekday(routine, day.value)) ? (
                        <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider">
                          EVERY DAY
                        </span>
                      ) : null}
                    </div>
                    
                    <div className="flex items-center justify-between gap-1 p-2 bg-black/40 border border-white/5 rounded-2xl">
                      {WEEKDAYS.map((day) => {
                        const isSelected = isRoutineScheduledForWeekday(routine, day.value);
                        return (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => handleToggleDay(routine, day.value)}
                            title={`${day.name}: ${isSelected ? 'Active' : 'Inactive'}`}
                            className={`
                              flex-1 py-1.5 rounded-xl flex flex-col items-center justify-center text-[10px] font-mono font-medium transition-all cursor-pointer active-press
                              ${isSelected 
                                ? 'bg-white text-black font-semibold shadow-sm' 
                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                              }
                            `}
                          >
                            <span className="text-[10px]">{day.label}</span>
                            <span className="text-[8px] leading-none mt-0.5">{isSelected ? '●' : '○'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Notes Area (First-Class Property) */}
                  <div className="pt-1">
                    {routine.notes ? (
                      <div 
                        onClick={() => openNoteModal(routine)}
                        className="group relative bg-black/30 hover:bg-black/50 border border-white/5 hover:border-white/15 p-3.5 rounded-2xl flex items-start justify-between cursor-pointer transition-all active-press"
                      >
                        <div className="space-y-0.5 min-w-0 pr-4">
                          <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block">
                            NOTES
                          </span>
                          <p className="text-xs font-sans text-zinc-200 italic leading-relaxed break-words">
                            "{routine.notes}"
                          </p>
                        </div>
                        <div className="p-1 text-zinc-500 group-hover:text-white transition-colors shrink-0">
                          <Edit3 size={11} />
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openNoteModal(routine)}
                        className="w-full py-2.5 px-3 bg-zinc-900/30 hover:bg-zinc-850/60 border border-dashed border-white/10 hover:border-white/20 rounded-2xl flex items-center justify-center space-x-1.5 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer active-press"
                      >
                        <Plus size={11} />
                        <span>NOTES: ADD NOTE</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Interactive Time Picker Modal */}
      <Modal
        isOpen={Boolean(timePickerTarget)}
        onClose={() => setTimePickerTarget(null)}
        title={`SET REMINDER • ${timePickerTarget?.routineName || ''}`}
        size="sm"
      >
        <div className="space-y-5 font-mono">
          <div className="space-y-2">
            <label className="text-[10px] tracking-widest text-zinc-400 uppercase block">
              CHOOSE TIME (24H / LOCAL)
            </label>
            <input
              type="time"
              value={selectedTimeInput}
              onChange={(e) => setSelectedTimeInput(e.target.value)}
              className="w-full px-4 py-3.5 bg-black/60 border border-white/15 rounded-2xl text-white text-lg font-mono outline-none focus:border-white transition-all text-center tracking-widest"
            />
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <span className="text-[9px] tracking-widest text-zinc-500 uppercase block">
              QUICK PRESETS
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {TIME_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setSelectedTimeInput(preset.value)}
                  className={`
                    py-2 px-1 text-[10px] rounded-xl border text-center transition-all cursor-pointer active-press
                    ${selectedTimeInput === preset.value 
                      ? 'bg-white text-black font-semibold border-white' 
                      : 'bg-zinc-900/60 text-zinc-400 border-white/5 hover:border-white/20'
                    }
                  `}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-white/5">
            {timePickerTarget?.currentTime && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSaveTime(null)}
                className="flex-1 text-red-400 border-red-500/20 hover:border-red-500/40 text-xs"
              >
                CLEAR TIME
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => handleSaveTime(selectedTimeInput)}
              className="flex-1 text-xs"
            >
              SAVE REMINDER
            </Button>
          </div>
        </div>
      </Modal>

      {/* Interactive Duration Picker Modal */}
      <Modal
        isOpen={Boolean(durationPickerTarget)}
        onClose={() => setDurationPickerTarget(null)}
        title={`SET DURATION • ${durationPickerTarget?.routineName || ''}`}
        size="sm"
      >
        <div className="space-y-5 font-mono">
          {/* Quick Presets */}
          <div className="space-y-2">
            <span className="text-[10px] tracking-widest text-zinc-400 uppercase block">
              SELECT DURATION
            </span>
            <div className="grid grid-cols-4 gap-2">
              {DURATION_PRESETS.map((dur) => (
                <button
                  key={dur}
                  type="button"
                  onClick={() => setSelectedDurationInput(dur)}
                  className={`
                    py-2.5 px-2 text-xs rounded-xl border text-center transition-all cursor-pointer active-press
                    ${selectedDurationInput === dur 
                      ? 'bg-white text-black font-semibold border-white' 
                      : 'bg-zinc-900/60 text-zinc-400 border-white/5 hover:border-white/20'
                    }
                  `}
                >
                  {dur} MIN
                </button>
              ))}
            </div>
          </div>

          {/* Custom Duration Input */}
          <div className="space-y-1.5 pt-2 border-t border-white/5">
            <label className="text-[10px] tracking-widest text-zinc-500 uppercase block">
              CUSTOM MINUTES
            </label>
            <input
              type="number"
              min="1"
              max="480"
              value={selectedDurationInput}
              onChange={(e) => setSelectedDurationInput(Math.max(1, Number(e.target.value)))}
              className="w-full px-4 py-2.5 bg-black/60 border border-white/15 rounded-2xl text-white font-mono text-sm outline-none focus:border-white transition-all text-center"
            />
          </div>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => handleSaveDuration(selectedDurationInput)}
            className="w-full text-xs"
          >
            CONFIRM DURATION
          </Button>
        </div>
      </Modal>

      {/* Interactive Note Modal */}
      <Modal
        isOpen={Boolean(noteModalTarget)}
        onClose={() => setNoteModalTarget(null)}
        title={`NOTES • ${noteModalTarget?.routineName || ''}`}
        size="sm"
      >
        <div className="space-y-4 font-mono">
          <div className="space-y-2">
            <label className="text-[10px] tracking-widest text-zinc-400 uppercase block">
              PERSONAL MOTIVATIONAL NOTE
            </label>
            <textarea
              rows={3}
              placeholder="e.g. No excuses. Focus on form."
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              className="w-full px-4 py-3 bg-black/60 border border-white/15 rounded-2xl text-white font-sans text-xs outline-none focus:border-white transition-all resize-none leading-relaxed"
            />
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <span className="text-[9px] tracking-widest text-zinc-500 uppercase block">
              QUICK SUGGESTIONS
            </span>
            <div className="flex flex-wrap gap-1.5">
              {NOTE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setNoteInput(preset)}
                  className="px-2.5 py-1 bg-zinc-900/60 hover:bg-zinc-800 border border-white/5 hover:border-white/20 rounded-lg text-[10px] font-mono text-zinc-400 hover:text-white transition-all cursor-pointer active-press"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-white/5">
            {noteModalTarget?.currentNotes && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSaveNote('')}
                className="flex-1 text-red-400 border-red-500/20 hover:border-red-500/40 text-xs"
              >
                CLEAR NOTE
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => handleSaveNote(noteInput)}
              className="flex-1 text-xs"
            >
              SAVE NOTE
            </Button>
          </div>
        </div>
      </Modal>

      {/* Unified Routine Creation / Edit Modal */}
      <RoutineModal
        isOpen={isRoutineModalOpen}
        onClose={() => {
          setIsRoutineModalOpen(false);
          setRoutineToEdit(null);
        }}
        onSubmit={handleRoutineModalSubmit}
        routineToEdit={routineToEdit}
      />

      {/* Spacing */}
      <div className="h-16" />
    </div>
  );
};
