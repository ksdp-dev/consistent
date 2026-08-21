import React from 'react';
import { motion } from 'motion/react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  ...props
}) => {
  const baseStyle = "relative inline-flex items-center justify-center font-sans font-medium transition-all duration-200 outline-none select-none disabled:opacity-40 disabled:pointer-events-none active-press";
  
  const variants = {
    primary: "bg-white text-black hover:bg-zinc-200 border border-white",
    secondary: "bg-zinc-900/60 text-white hover:bg-zinc-800 border border-white/10",
    outline: "bg-transparent text-white border border-white/10 hover:border-white/25 hover:bg-zinc-900/40",
    danger: "bg-red-950 text-red-200 hover:bg-red-900 border border-red-900",
    ghost: "bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-900/40"
  };

  const sizes = {
    sm: "px-4 py-1.5 text-xs rounded-full font-mono tracking-wider",
    md: "px-5 py-2.5 text-sm rounded-2xl",
    lg: "px-6 py-3.5 text-base rounded-2xl font-display tracking-tight",
    icon: "p-2.5 rounded-full"
  };

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center space-x-2">
          <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {!props.title && <span>PROCESSING...</span>}
        </span>
      ) : children}
    </button>
  );
};
