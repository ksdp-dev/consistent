import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface PwaLaunchSplashProps {
  onComplete: () => void;
}

export const PwaLaunchSplash: React.FC<PwaLaunchSplashProps> = ({ onComplete }) => {
  // Step 0 = "Made with love by Pi", Step 1 = "Made with love by Sai", Step 2 = Done
  const [step, setStep] = useState<number>(0);

  useEffect(() => {
    // Step 0: Pi for 1100ms
    const timer1 = setTimeout(() => {
      setStep(1);
    }, 1100);

    // Step 1: Sai for 1100ms
    const timer2 = setTimeout(() => {
      setStep(2);
    }, 2200);

    // Transition out and complete
    const timer3 = setTimeout(() => {
      onComplete();
    }, 2600);

    // Fallback safety watchdog (max 3.2s)
    const fallbackWatchdog = setTimeout(() => {
      onComplete();
    }, 3200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(fallbackWatchdog);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(8px)' }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center font-mono select-none px-6"
    >
      {/* Background dot mesh & soft glow */}
      <div className="absolute inset-0 dot-grid pointer-events-none opacity-40" />
      <div className="absolute w-72 h-72 bg-white/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative flex flex-col items-center justify-center z-10 text-center">
        {/* Minimal glyph indicator */}
        <div className="mb-8 relative flex items-center justify-center">
          <motion.div
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="w-12 h-12 rounded-full border border-dotted border-white/40 flex items-center justify-center"
          />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
        </div>

        {/* Animated text sequences */}
        <div className="h-14 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="credit-pi"
                initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center space-y-1"
              >
                <span className="text-[10px] tracking-[0.25em] text-zinc-500 uppercase">
                  CONSISTENT
                </span>
                <p className="text-sm font-sans font-light tracking-wide text-zinc-200">
                  Made with love by <span className="text-white font-medium">Pi</span>
                </p>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="credit-sai"
                initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center space-y-1"
              >
                <span className="text-[10px] tracking-[0.25em] text-zinc-500 uppercase">
                  CONSISTENT
                </span>
                <p className="text-sm font-sans font-light tracking-wide text-zinc-200">
                  Made with love by <span className="text-white font-medium">Sai</span>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
