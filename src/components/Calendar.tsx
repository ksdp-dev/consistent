import React from 'react';
import { motion } from 'motion/react';

interface WeeklyCalendarStripProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateString: string) => void;
  completions: { [dateString: string]: number }; // dateString -> count of completed goals
}

export const WeeklyCalendarStrip: React.FC<WeeklyCalendarStripProps> = ({
  selectedDate,
  onSelectDate,
  completions
}) => {
  const today = new Date();
  
  // Get days of the current week (Monday to Sunday)
  const getDaysOfWeek = () => {
    const currentDay = today.getDay(); // 0 (Sun) to 6 (Sat)
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + mondayOffset + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${date}`;
      days.push({
        dateString,
        dayNum: d.getDate(),
        dayName: d.toLocaleDateString('en-US', { weekday: 'narrow' }), // M, T, W, T, F, S, S
        isToday: dateString === today.toLocaleDateString('sv'),
      });
    }
    return days;
  };

  const days = getDaysOfWeek();

  return (
    <div className="w-full flex items-center justify-between py-2 border-b border-white/5 font-sans">
      {days.map((day) => {
        const isSelected = day.dateString === selectedDate;
        const completionCount = completions[day.dateString] || 0;
        
        return (
          <button
            key={day.dateString}
            onClick={() => onSelectDate(day.dateString)}
            className="flex-1 flex flex-col items-center py-2 relative outline-none cursor-pointer group active-press"
          >
            {/* Day Letter */}
            <span className="text-[10px] font-mono tracking-widest text-zinc-500 mb-2 uppercase group-hover:text-zinc-300">
              {day.dayName}
            </span>
            
            {/* Day Number inside interactive bubble */}
            <div className={`
              w-9 h-9 rounded-full flex items-center justify-center text-xs font-mono transition-all duration-200
              ${isSelected ? 'bg-white text-black font-semibold' : ''}
              ${!isSelected && day.isToday ? 'border border-white/20 text-white font-semibold' : ''}
              ${!isSelected && !day.isToday ? 'text-zinc-500 hover:bg-zinc-800/40 hover:text-white' : ''}
            `}>
              {day.dayNum}
            </div>

            {/* Completion dots indicator */}
            <div className="flex gap-0.5 justify-center mt-2 h-1 w-full">
              {completionCount > 0 && (
                <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-zinc-900' : 'bg-white/60 animate-pulse'}`} />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};


interface CalendarHeatmapProps {
  monthlyProgress: { [dateString: string]: number }; // dateString -> completions
}

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({ monthlyProgress }) => {
  // We render a grid of the last 12 weeks (84 days) for a gorgeous mobile/desktop responsive heatmap grid
  const daysToShow = 84; // 12 weeks
  const today = new Date();
  
  const getPastDays = () => {
    const list = [];
    for (let i = daysToShow - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${date}`;
      list.push({
        dateString,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        monthName: d.toLocaleDateString('en-US', { month: 'short' }),
        dateNum: d.getDate(),
      });
    }
    return list;
  };

  const daysList = getPastDays();

  // Group into weeks
  const weeks = [];
  for (let i = 0; i < daysList.length; i += 7) {
    weeks.push(daysList.slice(i, i + 7));
  }

  // Get color intensity using transparent white classes from the Immersive UI design theme
  const getIntensityClass = (count: number) => {
    if (count === 0) return 'bg-white/5 border border-transparent';
    if (count === 1) return 'bg-white/20 border border-transparent';
    if (count === 2) return 'bg-white/40 border border-transparent';
    return 'bg-white/80 border border-transparent'; // 3+ completions
  };

  return (
    <div className="w-full flex flex-col space-y-3 font-sans">
      <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 uppercase tracking-widest px-1">
        <span>84 DAYS CONSISTENCY HEATMAP</span>
        <div className="flex items-center space-x-1.5 font-mono">
          <span>LESS</span>
          <div className="w-2.5 h-2.5 rounded bg-white/5" />
          <div className="w-2.5 h-2.5 rounded bg-white/20" />
          <div className="w-2.5 h-2.5 rounded bg-white/40" />
          <div className="w-2.5 h-2.5 rounded bg-white/80" />
          <span>MORE</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="flex space-x-1 min-w-[340px]">
          {weeks.map((week, weekIdx) => {
            // Find month label for this week if it's the start of a month
            const hasNewMonth = weekIdx === 0 || week[0].dateNum <= 7;
            const monthLabel = hasNewMonth ? week[0].monthName : '';

            return (
              <div key={weekIdx} className="flex flex-col space-y-1 flex-1 relative pt-4">
                {monthLabel && (
                  <span className="absolute top-0 left-0 text-[9px] font-mono text-zinc-500 uppercase tracking-tight">
                    {monthLabel}
                  </span>
                )}
                {week.map((day) => {
                  const count = monthlyProgress[day.dateString] || 0;
                  return (
                    <div
                      key={day.dateString}
                      title={`${day.dateString}: ${count} completions`}
                      className={`
                        aspect-square w-full rounded-sm transition-all duration-300 hover:scale-110 cursor-help
                        ${getIntensityClass(count)}
                      `}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
