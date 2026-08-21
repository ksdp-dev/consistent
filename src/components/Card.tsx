import React from 'react';
import { motion } from 'motion/react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  animated?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  onClick,
  hoverable = false,
  animated = false
}) => {
  const baseStyle = `
    relative overflow-hidden bg-zinc-900/40 border border-white/5 rounded-[32px] p-6 
    backdrop-blur-md transition-all duration-300
    ${hoverable ? 'hover:border-white/10 hover:bg-zinc-900/60 cursor-pointer' : ''}
    ${className}
  `;

  if (animated) {
    return (
      <motion.div
        whileHover={hoverable ? { y: -2, scale: 1.005 } : undefined}
        whileTap={onClick ? { scale: 0.99 } : undefined}
        onClick={onClick}
        className={baseStyle}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div onClick={onClick} className={baseStyle}>
      {children}
    </div>
  );
};
