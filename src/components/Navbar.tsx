import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Bell, BellOff, LogOut } from 'lucide-react';
import { useGoalTracker } from '../context/GoalContext';

interface NavbarProps {
  onSignOut?: () => void;
}

export const Navbar: React.FC<NavbarProps> = () => {
  const { user, profile, logout } = useAuth();
  const { notificationsEnabled, requestNotificationPermission } = useGoalTracker();

  const displayName = profile?.name || 'Operator';

  return (
    <header className="sticky top-0 z-40 w-full bg-black/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between font-mono">
      {/* Brand logo in Nothing OS style */}
      <div className="flex items-center space-x-2">
        <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
        <span className="text-sm font-bold tracking-[0.25em] text-white uppercase">
          CONSISTENT<span className="text-white/40">.</span>
        </span>
      </div>

      {user && (
        <div className="flex items-center space-x-3 text-neutral-400">
          {/* Notification Button */}
          <button
            onClick={requestNotificationPermission}
            title={notificationsEnabled ? 'Notifications Active' : 'Enable Notifications'}
            className="p-1.5 rounded-lg border border-white/10 bg-zinc-900/60 hover:text-white hover:border-white/30 transition-all cursor-pointer active-press"
          >
            {notificationsEnabled ? (
              <Bell size={14} className="text-white animate-bounce" />
            ) : (
              <BellOff size={14} className="text-neutral-600" />
            )}
          </button>

          {/* User Display Name */}
          <span className="hidden sm:inline-block text-[10px] tracking-widest text-zinc-400 font-mono uppercase">
            {displayName}
          </span>

          {/* Sign Out Shortcut */}
          <button
            onClick={logout}
            title="Log Out"
            className="p-1.5 rounded-lg border border-white/10 bg-zinc-900/60 hover:text-red-400 hover:border-red-950 transition-all cursor-pointer active-press"
          >
            <LogOut size={14} />
          </button>
        </div>
      )}
    </header>
  );
};
