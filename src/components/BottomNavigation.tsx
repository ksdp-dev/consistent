import React from 'react';
import { LayoutDashboard, Target, User } from 'lucide-react';
import { motion } from 'motion/react';

export type TabType = 'dashboard' | 'goals' | 'profile';

interface BottomNavigationProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onChangeTab
}) => {
  const tabs = [
    { id: 'dashboard' as TabType, label: 'DASHBOARD', icon: LayoutDashboard },
    { id: 'goals' as TabType, label: 'GOALS', icon: Target },
    { id: 'profile' as TabType, label: 'PROFILE', icon: User }
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2.5rem)] max-w-md">
      <nav className="relative flex items-center justify-around bg-zinc-900/60 border border-white/5 rounded-[32px] py-4 px-3 shadow-2xl backdrop-blur-xl">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className="flex-1 flex flex-col items-center justify-center relative py-1 focus:outline-none select-none cursor-pointer group active-press"
            >
              {/* Active Glow Pill */}
              {isActive && (
                <motion.div
                  layoutId="activeTabPill"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  className="absolute inset-x-3 -top-1.5 bottom-0.5 bg-white/10 rounded-full -z-10 border border-white/5"
                />
              )}

              <Icon
                size={18}
                className={`transition-colors duration-200 mb-1 ${
                  isActive ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'
                }`}
              />
              
              <span className={`text-[9px] font-mono tracking-widest transition-colors duration-200 ${
                isActive ? 'text-white font-medium' : 'text-zinc-500 group-hover:text-zinc-400'
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
