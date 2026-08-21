/**
 * PWA Installation & Lifecycle Manager
 * Handles native beforeinstallprompt, appinstalled, standalone detection, and safe prompt execution.
 */

// Deferred native BeforeInstallPromptEvent
let deferredPrompt: any = null;
let promptAttempted = false;

// Callbacks for state listeners
const listeners = new Set<(isInstallable: boolean, isInstalled: boolean) => void>();

/**
 * Detects if Consistent is already running in standalone PWA mode.
 */
export function isPwaInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Standalone display mode check (Chromium, Firefox, iOS 13+)
  const isDisplayStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  
  // iOS Safari standalone check
  const isIosStandalone = !!((window.navigator as any).standalone);
  
  // Previously recorded successful install flag
  const isStoredInstalled = localStorage.getItem('consistent_pwa_installed') === 'true';
  
  return isDisplayStandalone || isIosStandalone || isStoredInstalled;
}

/**
 * Check if the browser currently has a captured native install prompt available.
 */
export function isNativeInstallAvailable(): boolean {
  return !!deferredPrompt && !isPwaInstalled();
}

function notifyListeners() {
  const installable = isNativeInstallAvailable();
  const installed = isPwaInstalled();
  listeners.forEach((listener) => listener(installable, installed));
}

/**
 * Subscribe to PWA installation state changes.
 */
export function subscribePwaState(callback: (isInstallable: boolean, isInstalled: boolean) => void): () => void {
  listeners.add(callback);
  callback(isNativeInstallAvailable(), isPwaInstalled());
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Initialize PWA event listeners. Call once during application boot.
 */
export function initPwaManager(): void {
  if (typeof window === 'undefined') return;

  // 1. Capture beforeinstallprompt event safely
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    // Prevent default mini-infobar or premature browser behavior
    e.preventDefault();
    deferredPrompt = e;
    notifyListeners();
  });

  // 2. Listen for appinstalled event
  window.addEventListener('appinstalled', () => {
    localStorage.setItem('consistent_pwa_installed', 'true');
    deferredPrompt = null;
    notifyListeners();
  });

  // 3. Listen for display-mode change
  if (window.matchMedia) {
    window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
      if (e.matches) {
        localStorage.setItem('consistent_pwa_installed', 'true');
        deferredPrompt = null;
        notifyListeners();
      }
    });
  }
}

/**
 * Triggers the native browser installation prompt if available.
 * Handles userChoice and prevents spamming.
 */
export async function triggerNativeInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (isPwaInstalled()) {
    return 'unavailable';
  }

  if (!deferredPrompt) {
    return 'unavailable';
  }

  const promptEvent = deferredPrompt;
  deferredPrompt = null; // Clear so it cannot be called repeatedly
  promptAttempted = true;
  notifyListeners();

  try {
    // Call the native browser prompt
    await promptEvent.prompt();

    // Await the user's choice
    const choiceResult = await promptEvent.userChoice;

    if (choiceResult && choiceResult.outcome === 'accepted') {
      localStorage.setItem('consistent_pwa_installed', 'true');
      notifyListeners();
      return 'accepted';
    } else {
      // User dismissed - record in session so we don't spam in the same session
      sessionStorage.setItem('consistent_pwa_prompt_dismissed', Date.now().toString());
      notifyListeners();
      return 'dismissed';
    }
  } catch (err) {
    console.warn('Native PWA install prompt error:', err);
    return 'unavailable';
  }
}

/**
 * Checks and triggers native install prompt automatically if appropriate (once per session on app load).
 */
export async function autoTriggerInstallIfEligible(): Promise<void> {
  if (isPwaInstalled()) return;
  if (promptAttempted) return;
  if (sessionStorage.getItem('consistent_pwa_prompt_dismissed')) return;

  if (deferredPrompt) {
    await triggerNativeInstallPrompt();
  }
}
