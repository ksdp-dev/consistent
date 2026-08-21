import React from 'react';
import { motion } from 'motion/react';

interface ProgressRingProps {
  progress: number; // 0 to 100
  size?: number; // width & height of svg
  strokeWidth?: number;
  className?: string;
  showText?: boolean;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = 80,
  strokeWidth = 6,
  className = '',
  showText = true
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  // Constrain progress between 0 and 100
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;

  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Track circle */}
        <circle
          className="text-neutral-900"
          stroke="currentColor"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        
        {/* Progress circle */}
        <motion.circle
          className="text-white"
          stroke="currentColor"
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          strokeLinecap="round"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      
      {showText && (
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-xs font-mono font-medium text-white">
            {Math.round(clampedProgress)}%
          </span>
        </div>
      )}
    </div>
  );
};
