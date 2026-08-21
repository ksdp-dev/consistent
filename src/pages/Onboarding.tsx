import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { motion } from 'motion/react';

export const OnboardingPage: React.FC = () => {
  const { user, completeOnboarding } = useAuth();
  const [name, setName] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const isFormValid = name.trim().length > 0 && !isNaN(parseInt(age, 10)) && parseInt(age, 10) >= 5 && parseInt(age, 10) <= 120;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter your preferred name.');
      return;
    }

    const ageNum = parseInt(age, 10);
    if (!age || isNaN(ageNum) || ageNum < 5 || ageNum > 120) {
      setError('Please enter a valid age between 5 and 120.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await completeOnboarding(trimmedName, ageNum);
    } catch (err: any) {
      console.error(err);
      setError('Failed to save profile parameters. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 selection:bg-zinc-800">
      {/* Subtle ambient lighting & dot grid */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[600px] h-[600px] bg-white opacity-[0.03] blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[-10%] w-[400px] h-[400px] bg-white opacity-[0.02] blur-[100px] rounded-full" />
      </div>
      <div className="absolute inset-0 dot-grid pointer-events-none z-0" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black pointer-events-none z-0" />

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md flex flex-col items-center"
      >
        {/* Header Branding */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full border-2 border-dotted border-white/20 flex items-center justify-center mb-4 relative group">
            <div className="absolute inset-0 rounded-full border border-white/10 animate-pulse opacity-40 scale-105" />
            <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
          </div>
          
          <h1 className="text-2xl font-bold tracking-tight text-white font-display">
            INITIAL CALIBRATION
          </h1>
          <p className="mt-1.5 text-xs font-mono text-zinc-500 uppercase tracking-widest leading-relaxed">
            Let's set up your system.
          </p>
        </div>

        {/* Onboarding Card */}
        <div className="w-full bg-zinc-900/40 border border-white/5 rounded-[32px] p-7 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 bg-red-950/20 border border-red-900/50 rounded-2xl text-[11px] font-mono text-red-400 leading-relaxed text-center"
              >
                {error}
              </motion.div>
            )}

            {/* NAME Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase font-semibold block">
                NAME
              </label>
              <p className="text-[11px] font-mono text-zinc-500 mb-1">
                What should we call you?
              </p>
              <Input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
                autoFocus
              />
            </div>

            {/* AGE Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase font-semibold block">
                AGE
              </label>
              <p className="text-[11px] font-mono text-zinc-500 mb-1">
                How old are you?
              </p>
              <Input
                type="number"
                placeholder="Enter your age"
                min={5}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {/* CONTINUE Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                className={`w-full py-3.5 flex items-center justify-center font-mono tracking-widest text-xs transition-all duration-200 ${
                  !isFormValid && !loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={loading || !isFormValid}
                isLoading={loading}
              >
                {loading ? 'INITIALIZING...' : 'CONTINUE'}
              </Button>
            </div>

            {user?.email && (
              <div className="pt-1 text-center text-[10px] font-mono text-zinc-600 truncate">
                AUTHENTICATED AS <span className="text-zinc-400">{user.email}</span>
              </div>
            )}
          </form>
        </div>
      </motion.div>
    </div>
  );
};
