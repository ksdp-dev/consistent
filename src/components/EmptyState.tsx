import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description: string;
  buttonText?: string;
  onButtonClick?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  buttonText,
  onButtonClick,
  icon
}) => {
  return (
    <div className="w-full flex flex-col items-center justify-center py-12 px-6 text-center border border-dashed border-neutral-900 rounded-2xl bg-neutral-950/20 font-sans">
      {/* Icon Area */}
      <div className="mb-4 text-neutral-600 flex justify-center">
        {icon ? (
          icon
        ) : (
          <div className="relative flex items-center justify-center w-12 h-12">
            <div className="absolute inset-0 rounded-full border border-neutral-800 animate-ping opacity-20" />
            <div className="w-8 h-8 rounded-full border border-dotted border-neutral-700" />
          </div>
        )}
      </div>

      <h4 className="text-sm font-semibold text-white uppercase tracking-tight mb-1.5 font-display">
        {title}
      </h4>
      
      <p className="text-xs text-neutral-500 max-w-xs mb-6 leading-relaxed font-mono">
        {description}
      </p>

      {buttonText && onButtonClick && (
        <Button variant="outline" size="sm" onClick={onButtonClick}>
          {buttonText}
        </Button>
      )}
    </div>
  );
};
