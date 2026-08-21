import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  itemName: string;
  isDeleting?: boolean;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
  isDeleting = false
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          id="confirm-delete-modal-container"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isDeleting && onClose()}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-sm bg-zinc-950/95 border border-red-900/30 rounded-3xl shadow-2xl p-6 z-10 backdrop-blur-xl space-y-4"
          >
            <div className="flex items-center space-x-3 text-red-400">
              <div className="w-10 h-10 rounded-2xl bg-red-950/50 border border-red-900/50 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white tracking-tight">{title}</h3>
                <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
                  DESTRUCTIVE ACTION
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 font-light leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-white">"{itemName}"</span>? This will remove the work from your active workspace.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-white/10 bg-transparent text-xs font-mono tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer disabled:opacity-50"
              >
                CANCEL
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={onConfirm}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-semibold tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-50 shadow-sm active:scale-95"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>DELETING...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>DELETE</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
