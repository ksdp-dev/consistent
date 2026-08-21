import React, { useState, useEffect, useRef } from 'react';
import { Routine, GoalCategory, CanonicalWeekday } from '../types';
import { X, Clock, Calendar, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (routineData: {
    title: string;
    note?: string;
    time: string;
    days: CanonicalWeekday[];
    category?: GoalCategory;
    emoji?: string;
  }) => Promise<void>;
  routineToEdit?: Routine | null;
}

const WEEKDAYS: Array<{ id: CanonicalWeekday; label: string; full: string }> = [
  { id: 'Mon', label: 'Mon', full: 'Monday' },
  { id: 'Tue', label: 'Tue', full: 'Tuesday' },
  { id: 'Wed', label: 'Wed', full: 'Wednesday' },
  { id: 'Thu', label: 'Thu', full: 'Thursday' },
  { id: 'Fri', label: 'Fri', full: 'Friday' },
  { id: 'Sat', label: 'Sat', full: 'Saturday' },
  { id: 'Sun', label: 'Sun', full: 'Sunday' },
];

const TIME_PRESETS = [
  { label: '06:00 AM', value: '06:00' },
  { label: '07:30 AM', value: '07:30' },
  { label: '09:00 AM', value: '09:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '06:00 PM', value: '18:00' },
  { label: '08:30 PM', value: '20:30' },
  { label: '09:30 PM', value: '21:30' },
];

const CATEGORY_OPTIONS: Array<{ category: GoalCategory; emoji: string; label: string }> = [
  { category: 'Fitness', emoji: '🏋️', label: 'Fitness' },
  { category: 'Study', emoji: '📚', label: 'Study' },
  { category: 'Reading', emoji: '📖', label: 'Reading' },
  { category: 'Work', emoji: '💻', label: 'Work' },
  { category: 'Health', emoji: '🧘', label: 'Health' },
  { category: 'Custom', emoji: '🎯', label: 'Custom' },
];

export function formatTime12hDisplay(timeStr?: string | null): string {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr || '00';
  if (isNaN(h)) return '';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
}

export const RoutineModal: React.FC<RoutineModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  routineToEdit
}) => {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [time, setTime] = useState('');
  const [selectedDays, setSelectedDays] = useState<CanonicalWeekday[]>([]);
  const [category, setCategory] = useState<GoalCategory>('Custom');
  const [emoji, setEmoji] = useState('🎯');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!routineToEdit;

  // Initialize or reset form on open
  useEffect(() => {
    if (isOpen) {
      if (routineToEdit) {
        setTitle(routineToEdit.title || routineToEdit.name || '');
        setNote(routineToEdit.note || routineToEdit.notes || '');
        setTime(routineToEdit.time || routineToEdit.reminderTime || '');
        
        // Extract days
        const raw = routineToEdit.days || routineToEdit.repeatSchedule || [];
        const daysArray: CanonicalWeekday[] = [];
        if (Array.isArray(raw)) {
          const numMap: { [n: number]: CanonicalWeekday } = {
            0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat'
          };
          for (const d of raw) {
            if (typeof d === 'number' && numMap[d]) {
              daysArray.push(numMap[d]);
            } else if (typeof d === 'string') {
              const cap = d.charAt(0).toUpperCase() + d.slice(1).toLowerCase();
              if (WEEKDAYS.some(w => w.id === cap)) {
                daysArray.push(cap as CanonicalWeekday);
              }
            }
          }
        }
        // Unique & canonical sort
        setSelectedDays(WEEKDAYS.map(w => w.id).filter(id => daysArray.includes(id)));
        setCategory(routineToEdit.category || 'Custom');
        setEmoji(routineToEdit.emoji || '🎯');
      } else {
        setTitle('');
        setNote('');
        setTime(''); // Force explicit selection
        setSelectedDays([]); // Force explicit day selection
        setCategory('Custom');
        setEmoji('🎯');
      }

      setError(null);
      setIsSubmitting(false);

      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, routineToEdit]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Toggle single weekday
  const handleToggleDay = (dayId: CanonicalWeekday) => {
    setError(null);
    setSelectedDays(prev => {
      const exists = prev.includes(dayId);
      const next = exists ? prev.filter(d => d !== dayId) : [...prev, dayId];
      // Keep in Mon..Sun canonical order
      return WEEKDAYS.map(w => w.id).filter(id => next.includes(id));
    });
  };

  // Quick day selectors
  const handleSelectEveryday = () => {
    setError(null);
    setSelectedDays(WEEKDAYS.map(w => w.id));
  };

  const handleSelectWeekdays = () => {
    setError(null);
    setSelectedDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  };

  const handleSelectWeekends = () => {
    setError(null);
    setSelectedDays(['Sat', 'Sun']);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Please enter a routine title.');
      titleInputRef.current?.focus();
      return;
    }

    if (selectedDays.length === 0) {
      setError('Please select at least one day of the week for this routine.');
      return;
    }

    if (!time || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time.trim())) {
      setError('Please choose a valid scheduled time (e.g. 07:30).');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit({
        title: trimmedTitle,
        note: note.trim() || undefined,
        time: time.trim(),
        days: selectedDays,
        category,
        emoji
      });
      onClose();
    } catch (err: any) {
      console.error('Routine submit failed', err);
      setError(err?.message || 'Failed to save routine. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          id="routine-modal-container" 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isSubmitting && onClose()}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-lg bg-zinc-950/95 border border-white/10 rounded-3xl shadow-2xl p-6 z-10 backdrop-blur-xl space-y-5 my-8"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center text-white text-base">
                  {emoji || '🎯'}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white tracking-tight">
                    {isEditing ? 'Edit Routine' : 'Create Recurring Routine'}
                  </h2>
                  <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
                    {isEditing ? 'UPDATE SCHEDULE & DETAILS' : 'CALIBRATE DAILY HABIT'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                aria-label="Close modal"
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            {/* Error Message Banner */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl flex items-center space-x-2 text-xs text-red-200"
              >
                <AlertCircle size={14} className="text-red-400 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Title Field */}
              <div className="space-y-1.5">
                <label 
                  htmlFor="routine-title-input" 
                  className="block text-xs font-mono text-zinc-400 uppercase tracking-wider"
                >
                  Routine Title <span className="text-red-400">*</span>
                </label>
                <input
                  id="routine-title-input"
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={isSubmitting}
                  placeholder="e.g., Morning Meditation, Deep Work, Gym Session"
                  className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/30 transition-all"
                  maxLength={120}
                  autoComplete="off"
                />
              </div>

              {/* Category & Emoji Selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono text-zinc-400 uppercase tracking-wider">
                  Category
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {CATEGORY_OPTIONS.map((cat) => {
                    const isSelected = category === cat.category;
                    return (
                      <button
                        key={cat.category}
                        type="button"
                        onClick={() => {
                          setCategory(cat.category);
                          setEmoji(cat.emoji);
                        }}
                        disabled={isSubmitting}
                        className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white text-black border-white font-semibold shadow-sm'
                            : 'bg-zinc-900/40 text-zinc-400 border-white/10 hover:border-white/20 hover:text-white'
                        }`}
                      >
                        <span>{cat.emoji}</span>
                        <span className="text-[11px] truncate">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Picker Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label 
                    htmlFor="routine-time-input" 
                    className="block text-xs font-mono text-zinc-400 uppercase tracking-wider"
                  >
                    Scheduled Time <span className="text-red-400">*</span>
                  </label>
                  {time && (
                    <span className="text-[11px] font-mono text-zinc-400">
                      Formatted: <span className="text-white font-semibold">{formatTime12hDisplay(time)}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <input
                      id="routine-time-input"
                      type="time"
                      value={time}
                      onChange={(e) => {
                        setTime(e.target.value);
                        if (error) setError(null);
                      }}
                      disabled={isSubmitting}
                      className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/30 transition-all font-mono"
                    />
                  </div>
                </div>

                {/* Quick Time Preset Chips */}
                <div className="flex items-center flex-wrap gap-1 pt-1">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase mr-1">Presets:</span>
                  {TIME_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => {
                        setTime(preset.value);
                        if (error) setError(null);
                      }}
                      disabled={isSubmitting}
                      className={`px-2 py-0.5 rounded-lg border text-[10px] font-mono transition-all cursor-pointer ${
                        time === preset.value
                          ? 'bg-zinc-800 text-white border-white/40 font-semibold'
                          : 'bg-zinc-900/30 text-zinc-400 border-white/5 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Day Selector Section */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-mono text-zinc-400 uppercase tracking-wider">
                    Repeat On <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={handleSelectEveryday}
                      disabled={isSubmitting}
                      className="text-[10px] font-mono text-zinc-400 hover:text-white hover:underline cursor-pointer px-1"
                    >
                      Everyday
                    </button>
                    <span className="text-zinc-600">•</span>
                    <button
                      type="button"
                      onClick={handleSelectWeekdays}
                      disabled={isSubmitting}
                      className="text-[10px] font-mono text-zinc-400 hover:text-white hover:underline cursor-pointer px-1"
                    >
                      Weekdays
                    </button>
                    <span className="text-zinc-600">•</span>
                    <button
                      type="button"
                      onClick={handleSelectWeekends}
                      disabled={isSubmitting}
                      className="text-[10px] font-mono text-zinc-400 hover:text-white hover:underline cursor-pointer px-1"
                    >
                      Weekends
                    </button>
                  </div>
                </div>

                {/* 7 Days Button Row */}
                <div className="grid grid-cols-7 gap-1.5">
                  {WEEKDAYS.map((day) => {
                    const isSelected = selectedDays.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        id={`day-select-${day.id.toLowerCase()}`}
                        onClick={() => handleToggleDay(day.id)}
                        disabled={isSubmitting}
                        title={day.full}
                        className={`h-10 rounded-xl border font-mono text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer select-none ${
                          isSelected
                            ? 'bg-white text-black border-white shadow-sm scale-[1.02]'
                            : 'bg-zinc-900/40 text-zinc-400 border-white/10 hover:border-white/20 hover:text-white'
                        }`}
                      >
                        <span>{day.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Days Summary */}
                <div className="text-[11px] font-mono text-zinc-500 pt-0.5">
                  {selectedDays.length === 0 ? (
                    <span className="text-amber-400/80">No days selected (select at least one)</span>
                  ) : selectedDays.length === 7 ? (
                    <span className="text-zinc-400">Repeats: <strong className="text-white">Every day</strong> (7 days/week)</span>
                  ) : (
                    <span className="text-zinc-400">
                      Repeats: <strong className="text-white">{selectedDays.join(', ')}</strong> ({selectedDays.length} {selectedDays.length === 1 ? 'day' : 'days'}/week)
                    </span>
                  )}
                </div>
              </div>

              {/* Note Field */}
              <div className="space-y-1.5 pt-1">
                <label 
                  htmlFor="routine-note-input" 
                  className="block text-xs font-mono text-zinc-400 uppercase tracking-wider"
                >
                  Note <span className="text-zinc-600">(Optional)</span>
                </label>
                <textarea
                  id="routine-note-input"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="e.g., Focus on posture, no distractions, log weights..."
                  className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/30 transition-all resize-none"
                  maxLength={300}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-white/10 bg-transparent text-xs font-mono tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer disabled:opacity-50"
                >
                  CANCEL
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim() || selectedDays.length === 0 || !time}
                  className="px-5 py-2 rounded-xl bg-white text-black font-mono text-xs font-semibold tracking-wider hover:bg-zinc-200 transition-all cursor-pointer flex items-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>{isEditing ? 'SAVING...' : 'CREATING...'}</span>
                    </>
                  ) : (
                    <span>{isEditing ? 'SAVE CHANGES' : 'CREATE ROUTINE'}</span>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
