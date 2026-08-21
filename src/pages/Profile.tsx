import React, { useState } from 'react';
import { useGoalTracker } from '../context/GoalContext';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { CalendarHeatmap } from '../components/Calendar';
import { Flame, Clock, CheckCircle2, Sliders, LogOut, User, Edit3 } from 'lucide-react';
import { motion } from 'motion/react';

export const ProfilePage: React.FC = () => {
  const { user, profile, updateUserProfile, logout } = useAuth();
  const { stats, notificationsEnabled, requestNotificationPermission } = useGoalTracker();

  // Profile Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>(profile?.name || '');
  const [editAge, setEditAge] = useState<string>(profile?.age?.toString() || '');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const getConsistencyRating = (rate: number) => {
    if (stats.totalGoalsCompleted === 0) return 'STARTING';
    if (rate >= 90) return 'ELITE';
    if (rate >= 75) return 'DISCIPLINED';
    if (rate >= 50) return 'DEVELOPING';
    if (rate >= 25) return 'INCONSISTENT';
    return 'STARTING';
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    const ageNum = parseInt(editAge, 10);
    if (isNaN(ageNum) || ageNum < 5 || ageNum > 120) return;

    setIsSaving(true);
    try {
      await updateUserProfile({
        name: editName.trim(),
        age: ageNum
      });
      setIsEditModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Sunday to Saturday labels
  const weekdaysFull = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  return (
    <div className="w-full space-y-6">
      
      {/* Header section */}
      <div className="flex items-center justify-between font-mono border-b border-white/5 pb-4 mt-2">
        <div className="flex flex-col space-y-1">
          <span className="text-[10px] tracking-[0.2em] text-zinc-500 uppercase">DIAGNOSTICS</span>
          <h1 className="text-xl font-bold tracking-tight text-white font-display">
            PERFORMANCE ENGINE
          </h1>
        </div>
        <button
          onClick={() => {
            setEditName(profile?.name || '');
            setEditAge(profile?.age?.toString() || '');
            setIsEditModalOpen(true);
          }}
          className="p-2 rounded-full border border-white/10 hover:border-white/30 text-zinc-400 hover:text-white transition-all cursor-pointer active-press"
          title="Edit Profile Parameters"
        >
          <Edit3 size={14} />
        </button>
      </div>

      {/* Performance Score & Level Showcase Card */}
      <div className="p-6 bg-zinc-900/40 border border-white/5 rounded-[32px] space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase">
              PERFORMANCE INDEX
            </span>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-display font-bold text-white">
                {stats.performanceScore ?? 0}
              </span>
              <span className="text-xs font-mono text-zinc-500">/ 100</span>
            </div>
          </div>

          <div className="flex flex-col items-end space-y-1">
            <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-mono font-semibold text-white tracking-wider uppercase">
              {stats.performanceLevel ?? 'Starting'}
            </span>
            <span className="text-[9px] font-mono text-zinc-500">
              {stats.performanceTagline ?? 'Calibrating Baseline'}
            </span>
          </div>
        </div>

        {/* Performance Bar Meter */}
        <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden relative">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stats.performanceScore ?? 0}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white h-full rounded-full"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-white/5 text-[11px] font-mono">
          <div className="flex justify-between">
            <span className="text-zinc-500">WEEKLY PROGRESS:</span>
            <span className="text-white font-medium">{stats.overallWeeklyProgress ?? 0}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">CONSISTENCY:</span>
            <span className="text-white font-medium">{stats.completionRate ?? 0}%</span>
          </div>
        </div>
      </div>

      {/* Hero Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        {/* Streak card */}
        <div className="p-5 bg-zinc-900/40 border border-white/5 rounded-3xl flex flex-col items-center text-center shadow-lg">
          <Flame size={16} className="text-zinc-500 mb-2" />
          <span className="text-[8px] font-mono tracking-wider text-zinc-500 uppercase">CURRENT / BEST</span>
          <span className="text-lg font-display font-bold text-white mt-1">
            {stats.currentStreak} <span className="text-xs font-normal text-zinc-500">/ {stats.bestStreak}</span>
          </span>
          <span className="text-[8px] font-mono text-zinc-600 mt-0.5">DAYS</span>
        </div>

        {/* Invested Hours card */}
        <div className="p-5 bg-zinc-900/40 border border-white/5 rounded-3xl flex flex-col items-center text-center shadow-lg">
          <Clock size={16} className="text-zinc-500 mb-2" />
          <span className="text-[8px] font-mono tracking-wider text-zinc-500 uppercase">FOCUS TIME</span>
          <span className="text-lg font-display font-bold text-white mt-1">{stats.totalHoursInvested}</span>
          <span className="text-[8px] font-mono text-zinc-600 mt-0.5">HOURS</span>
        </div>

        {/* Completed items card */}
        <div className="p-5 bg-zinc-900/40 border border-white/5 rounded-3xl flex flex-col items-center text-center shadow-lg">
          <CheckCircle2 size={16} className="text-zinc-500 mb-2" />
          <span className="text-[8px] font-mono tracking-wider text-zinc-500 uppercase">TOTAL UNIQUE</span>
          <span className="text-lg font-display font-bold text-white mt-1">{stats.totalGoalsCompleted}</span>
          <span className="text-[8px] font-mono text-zinc-600 mt-0.5">COMPLETED</span>
        </div>
      </div>

      {/* Weekly Progress Bar Graph (Sunday - Saturday, 0-100%) */}
      <div className="p-6 bg-zinc-900/40 border border-white/5 rounded-[32px] shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xs font-mono tracking-widest text-zinc-500 uppercase">
            WEEKLY DISCIPLINE METRICS
          </h3>
          <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
            0% - 100% SCALE
          </span>
        </div>
        
        {/* SVG/CSS Graph container */}
        <div className="h-32 w-full flex items-end justify-between px-1">
          {weekdaysFull.map((dayName, index) => {
            const percentage = stats.weeklyProgress[index.toString()] ?? 0;
            const completedCount = stats.weeklyCounts[index.toString()] ?? 0;

            return (
              <div key={dayName} className="flex flex-col items-center flex-1 space-y-2 group">
                {/* Tooltip percentage on hover */}
                <span className="text-[9px] font-mono text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {percentage}%
                </span>

                {/* Vertical Bar Column */}
                <div className="w-4 sm:w-6 bg-white/5 rounded-full relative overflow-hidden h-20 flex items-end">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${percentage}%` }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    className={`w-full rounded-full transition-colors ${percentage === 100 ? 'bg-white' : percentage > 0 ? 'bg-white/70' : 'bg-transparent'}`}
                  />
                </div>

                {/* Day Tag */}
                <span className="text-[9px] font-mono text-zinc-500 font-medium">
                  {dayName}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 84-Day Consistency Heatmap Grid */}
      <Card className="p-5 bg-neutral-950/40 border border-neutral-900 shadow-lg">
        <CalendarHeatmap monthlyProgress={stats.monthlyProgress} />
      </Card>

      {/* Preferences Section */}
      <div className="p-6 bg-zinc-900/40 border border-white/5 rounded-[32px] space-y-4 shadow-lg">
        <div className="flex items-center space-x-2 text-xs font-mono tracking-widest text-zinc-500 uppercase border-b border-white/5 pb-3">
          <Sliders size={12} />
          <span>PREFERENCES & METRICS</span>
        </div>

        {/* Dynamic Consistency Index */}
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-zinc-500 uppercase">CONSISTENCY VALUE (7-DAY)</span>
          <span className="text-white font-semibold">
            {stats.completionRate}% ({getConsistencyRating(stats.completionRate)})
          </span>
        </div>

        {/* Current Streak */}
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-zinc-500 uppercase">CURRENT STREAK</span>
          <span className="text-white font-semibold">
            {stats.currentStreak} DAYS
          </span>
        </div>

        {/* Notification Permission Toggle */}
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-zinc-500 uppercase">SYSTEM NOTIFICATIONS</span>
          <button
            onClick={requestNotificationPermission}
            className={`
              px-3.5 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all duration-200 outline-none cursor-pointer active-press
              ${notificationsEnabled 
                ? 'bg-zinc-800 text-green-400 border border-white/10' 
                : 'bg-white text-black hover:bg-zinc-200'
              }
            `}
          >
            {notificationsEnabled ? 'ENABLED' : 'REQUEST PERMISSION'}
          </button>
        </div>
      </div>

      {/* Account Info and Log Out */}
      <div className="p-6 bg-zinc-900/40 border border-white/5 rounded-[32px] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-lg">
        <div className="font-mono text-xs space-y-0.5">
          <span className="text-zinc-500 uppercase block">OPERATOR PROFILE</span>
          <span className="text-white font-medium block">
            {profile?.name || 'Operator'} {profile?.age ? `(${profile.age} yrs)` : ''}
          </span>
          <span className="text-zinc-500 text-[10px] truncate block max-w-xs">{user?.email}</span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={logout}
          className="flex items-center justify-center space-x-2 text-red-400 hover:text-red-300 border-white/10 hover:border-red-950 hover:bg-red-950/10"
        >
          <LogOut size={13} />
          <span>DISCONNECT (LOG OUT)</span>
        </Button>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="CALIBRATE PROFILE PARAMETERS"
      >
        <form onSubmit={handleSaveProfile} className="space-y-5">
          <Input
            label="FULL NAME / ALIAS"
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
            disabled={isSaving}
          />
          <Input
            label="AGE (YEARS)"
            type="number"
            min="5"
            max="120"
            value={editAge}
            onChange={(e) => setEditAge(e.target.value)}
            required
            disabled={isSaving}
          />
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            isLoading={isSaving}
          >
            UPDATE PARAMETERS
          </Button>
        </form>
      </Modal>

      {/* Extra bottom padding */}
      <div className="h-16" />
    </div>
  );
};
