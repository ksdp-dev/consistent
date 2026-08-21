import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="w-full flex flex-col space-y-1.5 font-sans">
      {label && (
        <label 
          htmlFor={inputId} 
          className="text-[11px] font-mono tracking-widest text-neutral-500 uppercase select-none"
        >
          {label}
        </label>
      )}
      
      <input
        id={inputId}
        className={`
          w-full px-4 py-3 bg-zinc-900/40 text-white border border-white/5 rounded-2xl 
          placeholder-zinc-500 text-sm outline-none transition-all duration-200
          focus:border-white/20 focus:bg-zinc-900/80
          disabled:opacity-40 disabled:cursor-not-allowed
          ${error ? 'border-red-900 focus:border-red-700' : ''}
          ${className}
        `}
        {...props}
      />
      
      {error && (
        <p className="text-[11px] font-mono text-red-500 uppercase tracking-tight">
          {error}
        </p>
      )}
      
      {!error && helperText && (
        <p className="text-[11px] font-mono text-neutral-500 tracking-tight">
          {helperText}
        </p>
      )}
    </div>
  );
};
