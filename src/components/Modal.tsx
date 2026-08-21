import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md'
}) => {
  // Prevent body scroll when open
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

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    full: "max-w-full h-full rounded-none"
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Content container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.95, y: 15, filter: 'blur(4px)' }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className={`
              relative w-full overflow-hidden bg-zinc-950/95 border border-white/10 
              rounded-[32px] shadow-2xl flex flex-col z-10 max-h-[90vh] backdrop-blur-xl
              ${sizeClasses[size]}
            `}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
              {title ? (
                <h3 className="text-base font-display font-semibold tracking-tight text-white uppercase">
                  {title}
                </h3>
              ) : (
                <div />
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-neutral-500 hover:text-white rounded-full hover:bg-neutral-900"
              >
                <X size={16} />
              </Button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
