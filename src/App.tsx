/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GoalProvider } from './context/GoalContext';
import { Navbar } from './components/Navbar';
import { BottomNavigation, TabType } from './components/BottomNavigation';
import { DashboardPage } from './pages/Dashboard';
import { GoalsPage } from './pages/Goals';
import { ProfilePage } from './pages/Profile';
import { AuthPage } from './pages/Auth';
import { OnboardingPage } from './pages/Onboarding';
import { LoadingScreen } from './components/LoadingScreen';
import { PwaLaunchSplash } from './components/PwaLaunchSplash';
import { motion, AnimatePresence } from 'motion/react';
import { autoTriggerInstallIfEligible } from './utils/pwaManager';

const AppContent: React.FC = () => {
  const { user, loading, needsOnboarding } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  // PWA & Startup Splash experience
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    // Show splash on every fresh application startup / reload
    return true;
  });

  const handleSplashComplete = () => {
    setShowSplash(false);
    // After splash completes, check if native install prompt is available and eligible
    setTimeout(() => {
      autoTriggerInstallIfEligible();
    }, 600);
  };

  if (showSplash) {
    return <PwaLaunchSplash onComplete={handleSplashComplete} />;
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <AuthPage />;
  }

  if (needsOnboarding) {
    return <OnboardingPage />;
  }

  // Helper to render the correct view with smooth motion fade transitions
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 15, filter: 'blur(5px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -15, filter: 'blur(5px)' }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <DashboardPage onNavigateToGoals={() => setActiveTab('goals')} />
          </motion.div>
        );
      case 'goals':
        return (
          <motion.div
            key="goals"
            initial={{ opacity: 0, y: 15, filter: 'blur(5px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -15, filter: 'blur(5px)' }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <GoalsPage />
          </motion.div>
        );
      case 'profile':
        return (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 15, filter: 'blur(5px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -15, filter: 'blur(5px)' }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <ProfilePage />
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative min-h-screen bg-black text-white flex flex-col font-sans selection:bg-zinc-800">
      {/* Immersive glow elements */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[600px] h-[600px] bg-white opacity-[0.03] blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[10%] right-[-10%] w-[400px] h-[400px] bg-white opacity-[0.02] blur-[100px] rounded-full"></div>
      </div>
      {/* Background static dot mesh texture */}
      <div className="absolute inset-0 dot-grid pointer-events-none z-0" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black pointer-events-none z-0" />

      {/* Persistent top bar */}
      <Navbar />

      {/* Center content slot container */}
      <main className="flex-1 w-full max-w-xl mx-auto px-6 py-6 pb-28 relative z-10 overflow-x-hidden">
        <AnimatePresence mode="wait">
          {renderTabContent()}
        </AnimatePresence>
      </main>

      {/* Persistent bottom bar navigation */}
      <BottomNavigation activeTab={activeTab} onChangeTab={setActiveTab} />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <GoalProvider>
        <AppContent />
      </GoalProvider>
    </AuthProvider>
  );
}
