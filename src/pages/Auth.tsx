import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { ToastMessage, ToastContainer } from '../components/Toast';
import { motion } from 'motion/react';

export const AuthPage: React.FC = () => {
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'error') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        showToast(err.message || 'Google Sign-In failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 select-none overflow-hidden dot-grid selection:bg-zinc-800">
      {/* Background ambient lighting and mask */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/80 to-black pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-white/[0.03] blur-[100px] pointer-events-none animate-pulse" />

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-sm flex flex-col items-center"
      >
        {/* Animated App Brand Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full border-2 border-dotted border-white/20 flex items-center justify-center mb-5 relative group">
            <div className="absolute inset-0 rounded-full border border-white/10 animate-pulse opacity-40 scale-105" />
            <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
          </div>
          
          <h1 className="text-xl font-bold tracking-[0.3em] text-white uppercase font-display">
            CONSISTENT<span className="text-white/40">.</span>
          </h1>
          <p className="mt-2 text-xs font-mono text-zinc-500 uppercase tracking-widest max-w-[280px] leading-relaxed">
            The premium habit tracking instrument.
          </p>
        </div>

        {/* Auth Action Card */}
        <div className="w-full bg-zinc-900/40 border border-white/5 rounded-[32px] p-8 shadow-2xl backdrop-blur-xl flex flex-col items-center text-center">
          <span className="text-[10px] font-mono tracking-[0.2em] text-zinc-500 uppercase mb-2">
            AUTHENTICATION
          </span>
          <p className="text-xs text-zinc-400 font-mono mb-6">
            Sign in with your Google account to access your routines and discipline metrics.
          </p>

          {/* Google Sign In Only */}
          <Button
            type="button"
            variant="primary"
            className="w-full py-3.5 flex items-center justify-center space-x-3 font-mono tracking-widest text-xs"
            onClick={handleGoogleSignIn}
            disabled={loading}
            isLoading={loading}
          >
            {!loading && (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
            )}
            <span>CONTINUE WITH GOOGLE</span>
          </Button>

          <div className="mt-6 pt-4 border-t border-white/5 w-full flex items-center justify-center space-x-1.5 text-[9px] font-mono text-zinc-600 tracking-wider">
            <span>SECURE CLOUD ENGINE</span>
            <span>•</span>
            <span>FIREBASE AUTH</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
