import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Sparkles } from 'lucide-react';

export interface CompletionOverlayProps {
  isOpen: boolean;
  word?: string;
  goalName?: string;
  title?: string;
  emoji?: string;
  itemType?: 'work' | 'routine';
  currentStreak?: number;
  totalCompleted?: number;
  onClose: () => void;
}

export const GoalCompletedOverlay: React.FC<CompletionOverlayProps> = ({
  isOpen,
  word = 'COMPLETED',
  goalName,
  title,
  emoji,
  itemType = 'routine',
  onClose
}) => {
  const displayTitle = title || goalName || 'Task';
  const displayWord = word || 'COMPLETED';

  useEffect(() => {
    if (isOpen) {
      // Auto-dismiss after 1.8 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 1800);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div 
          id="viewport-completion-portal"
          className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center px-4"
        >
          {/* Subtle radial backdrop glow for visual focus without blocking clicks */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px] pointer-events-none"
          />

          {/* Centered Celebration Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ 
              duration: 0.4, 
              ease: [0.16, 1, 0.3, 1] 
            }}
            className="relative z-10 bg-zinc-950/95 border border-white/20 rounded-3xl p-6 sm:p-8 max-w-xs sm:max-w-sm w-full mx-auto text-center shadow-2xl shadow-black/80 flex flex-col items-center space-y-3"
          >
            {/* Ambient subtle glow ring */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-white/10 to-white/5 rounded-3xl blur-xl -z-10" />

            {/* Icon / Emoji badge */}
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-2xl shadow-inner">
              {emoji ? (
                <span className="select-none">{emoji}</span>
              ) : (
                <CheckCircle2 size={28} className="text-white" />
              )}
            </div>

            {/* Action text */}
            <div className="space-y-1">
              <span className="text-[10px] font-mono tracking-[0.25em] text-zinc-400 uppercase">
                {itemType === 'work' ? 'WORK EXECUTED' : 'ROUTINE COMPLETED'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-white uppercase break-words">
                {displayWord}
              </h2>
            </div>

            {/* Item Title */}
            <p className="text-xs text-zinc-400 font-sans line-clamp-2 max-w-[240px]">
              {displayTitle}
            </p>

            {/* Micro subtle indicator */}
            <div className="pt-1 flex items-center space-x-1.5 text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
              <Sparkles size={10} className="text-zinc-400" />
              <span>RECORD SAVED</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
