import React from 'react';
import { motion } from 'motion/react';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center font-mono">
      <div className="relative flex items-center justify-center">
        {/* Glowing breathing ring matching Nothing OS launcher style */}
        <motion.div
          animate={{
            scale: [1, 1.12, 1],
            opacity: [0.35, 0.85, 0.35],
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="w-16 h-16 rounded-full border-2 border-dotted border-white/60 flex items-center justify-center"
        />
        
        {/* Tiny center dot */}
        <div className="absolute w-2 h-2 rounded-full bg-white animate-pulse" />
      </div>
      
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 0.5 }}
        className="mt-6 text-[10px] tracking-widest text-neutral-400 uppercase font-mono animate-pulse"
      >
        LOCKED IN...
      </motion.p>
    </div>
  );
};
