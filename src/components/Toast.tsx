import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, AlertCircle, CheckCircle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col space-y-2 w-full max-w-sm px-4 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const icons = {
            success: <CheckCircle size={16} className="text-white" />,
            error: <AlertCircle size={16} className="text-red-500" />,
            info: <Info size={16} className="text-neutral-400" />
          };

          const backgrounds = {
            success: "bg-neutral-950 border border-neutral-800 text-white",
            error: "bg-neutral-950 border border-red-950/80 text-red-100",
            info: "bg-neutral-950 border border-neutral-800 text-white"
          };

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -15, scale: 0.95, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, scale: 0.95, filter: 'blur(4px)' }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className={`
                pointer-events-auto flex items-center justify-between px-4 py-3 
                rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono tracking-wide uppercase
                ${backgrounds[toast.type]}
              `}
            >
              <div className="flex items-center space-x-3">
                {icons[toast.type]}
                <span>{toast.text}</span>
              </div>
              <button
                onClick={() => onRemove(toast.id)}
                className="text-neutral-500 hover:text-white transition-colors ml-4 outline-none cursor-pointer"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
