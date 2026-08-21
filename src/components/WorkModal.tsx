import React, { useState, useEffect, useRef } from 'react';
import { Work } from '../types';
import { X, Briefcase, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (workData: { title: string; description?: string }) => Promise<void>;
  workToEdit?: Work | null;
}

export const WorkModal: React.FC<WorkModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  workToEdit
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!workToEdit;

  useEffect(() => {
    if (isOpen) {
      if (workToEdit) {
        setTitle(workToEdit.title || '');
        setDescription(workToEdit.description || '');
      } else {
        setTitle('');
        setDescription('');
      }
      setError(null);
      setIsSubmitting(false);

      // Focus input after render
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, workToEdit]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Please enter a work title.');
      titleInputRef.current?.focus();
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit({
        title: trimmedTitle,
        description: description.trim() || undefined
      });
      onClose();
    } catch (err: any) {
      console.error('Work submit failed', err);
      setError(err?.message || 'Failed to save work. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          id="work-modal-container" 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
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
            className="relative w-full max-w-md bg-zinc-950/95 border border-white/10 rounded-3xl shadow-2xl p-6 z-10 backdrop-blur-xl space-y-5"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center text-white">
                  <Briefcase size={16} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white tracking-tight">
                    {isEditing ? 'Edit Work' : 'Add New Work'}
                  </h2>
                  <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
                    {isEditing ? 'UPDATE TASK DETAILS' : 'CREATE TRACKED WORK'}
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
                  htmlFor="work-title-input" 
                  className="block text-xs font-mono text-zinc-400 uppercase tracking-wider"
                >
                  Work Title <span className="text-red-400">*</span>
                </label>
                <input
                  id="work-title-input"
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={isSubmitting}
                  placeholder="e.g., Deliver Quarterly Strategy Deck"
                  className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/30 transition-all"
                  maxLength={160}
                  autoComplete="off"
                />
              </div>

              {/* Description Field */}
              <div className="space-y-1.5">
                <label 
                  htmlFor="work-desc-input" 
                  className="block text-xs font-mono text-zinc-400 uppercase tracking-wider"
                >
                  Description <span className="text-zinc-600">(Optional)</span>
                </label>
                <textarea
                  id="work-desc-input"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Notes, scope, sub-deliverables, or key links..."
                  className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/30 transition-all resize-none"
                  maxLength={500}
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
                  disabled={isSubmitting || !title.trim()}
                  className="px-5 py-2 rounded-xl bg-white text-black font-mono text-xs font-semibold tracking-wider hover:bg-zinc-200 transition-all cursor-pointer flex items-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>{isEditing ? 'SAVING...' : 'CREATING...'}</span>
                    </>
                  ) : (
                    <span>{isEditing ? 'SAVE CHANGES' : 'CREATE WORK'}</span>
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
