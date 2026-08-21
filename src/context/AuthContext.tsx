import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase/config';
import { UserProfile, AuthState } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  needsOnboarding: boolean;
  authState: AuthState;
  authError: string | null;
  loginWithGoogle: () => Promise<void>;
  completeOnboarding: (name: string, age: number | null) => Promise<void>;
  createUserProfile: (name: string, age: number | null) => Promise<void>;
  getUserProfile: (uid: string) => Promise<UserProfile | null>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  deleteUserProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const isLoggingInRef = useRef<boolean>(false);

  // Sync auth state and listen to Firestore users/{uid} in real time
  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthError(null);

      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);

        // Real-time listener on the user's document
        unsubscribeDoc = onSnapshot(
          userDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data() as UserProfile;
              const isCompleted = data && (data.profileCompleted === true || data.onboardingCompleted === true);
              const hasValidName = !!(data && data.name && data.name.trim().length > 0);
              const hasValidAge = data && data.age !== undefined && data.age !== null && !isNaN(Number(data.age)) && Number(data.age) >= 5 && Number(data.age) <= 120;
              
              if (isCompleted && hasValidName && hasValidAge) {
                setProfile({
                  ...data,
                  uid: currentUser.uid,
                  profileCompleted: true,
                  onboardingCompleted: true
                });
                setNeedsOnboarding(false);
              } else {
                setProfile(data ? { ...data, uid: currentUser.uid } : null);
                setNeedsOnboarding(true);
              }
            } else {
              // Document does NOT exist in Firestore -> New user -> show onboarding
              setProfile(null);
              setNeedsOnboarding(true);
            }
            setLoading(false);
          },
          (error) => {
            handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
            setProfile(null);
            setNeedsOnboarding(true);
            setLoading(false);
          }
        );
      } else {
        setProfile(null);
        setNeedsOnboarding(false);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) {
        unsubscribeDoc();
      }
    };
  }, []);

  const loginWithGoogle = async () => {
    if (isLoggingInRef.current) return;
    isLoggingInRef.current = true;
    setAuthError(null);

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      const currentUser = result.user;
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          const isCompleted = data && (data.profileCompleted || data.onboardingCompleted);
          const hasValidName = !!(data && data.name && data.name.trim().length > 0);
          const hasValidAge = data && data.age !== undefined && data.age !== null && !isNaN(Number(data.age)) && Number(data.age) >= 5 && Number(data.age) <= 120;
          
          if (isCompleted && hasValidName && hasValidAge) {
            // Existing user: do NOT overwrite permanent profile data with Google display name
            setProfile({
              ...data,
              uid: currentUser.uid,
              profileCompleted: true,
              onboardingCompleted: true
            });
            setNeedsOnboarding(false);
            return;
          }
        }
        // New user or incomplete profile
        setProfile(null);
        setNeedsOnboarding(true);
      }
    } catch (error: any) {
      console.error("Google login failed", error);
      if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
        setAuthError(error.message || 'Google Sign-In failed');
      }
      throw error;
    } finally {
      isLoggingInRef.current = false;
    }
  };

  const createUserProfile = async (name: string, age: number | null) => {
    if (!user) throw new Error("No authenticated user");
    const userDocRef = doc(db, 'users', user.uid);

    // Validation
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error("Validation Error: User name is required.");
    }

    const validAge = age !== null && !isNaN(Number(age)) ? Number(age) : null;
    if (validAge === null || validAge < 5 || validAge > 120) {
      throw new Error("Validation Error: Age must be a valid number between 5 and 120.");
    }

    // Preserve existing profile createdAt if document already exists
    const docSnap = await getDoc(userDocRef);
    let createdAt = new Date().toISOString();
    if (docSnap.exists()) {
      const existing = docSnap.data() as UserProfile;
      if (existing?.createdAt) {
        createdAt = typeof existing.createdAt === 'string' ? existing.createdAt : new Date(existing.createdAt).toISOString();
      }
    }

    const newProfile: UserProfile = {
      uid: user.uid,
      name: trimmedName,
      age: validAge,
      email: user.email || '',
      profileCompleted: true,
      onboardingCompleted: true,
      createdAt: createdAt,
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(userDocRef, newProfile, { merge: true });
      setProfile(newProfile);
      setNeedsOnboarding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      throw error;
    }
  };

  const completeOnboarding = async (name: string, age: number | null) => {
    return createUserProfile(name, age);
  };

  const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
    if (!user) return null;
    try {
      const docSnap = await getDoc(doc(db, 'users', uid));
      if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
      return null;
    }
  };

  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    
    // Prevent updating with invalid name
    if (updates.name !== undefined && !updates.name.trim()) {
      throw new Error("Validation Error: User name cannot be empty.");
    }

    if (updates.age !== undefined && updates.age !== null) {
      const ageNum = Number(updates.age);
      if (isNaN(ageNum) || ageNum < 5 || ageNum > 120) {
        throw new Error("Validation Error: Age must be between 5 and 120.");
      }
    }

    const cleanUpdates: Partial<UserProfile> = {
      ...updates,
      updatedAt: new Date().toISOString()
    };

    if (cleanUpdates.name) {
      cleanUpdates.name = cleanUpdates.name.trim();
    }
    if (cleanUpdates.age !== undefined && cleanUpdates.age !== null) {
      cleanUpdates.age = Number(cleanUpdates.age);
    }

    try {
      await updateDoc(doc(db, 'users', user.uid), cleanUpdates);
      if (profile) {
        setProfile({ ...profile, ...cleanUpdates });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      throw error;
    }
  };

  const deleteUserProfile = async () => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid));
      setProfile(null);
      setNeedsOnboarding(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}`);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setProfile(null);
      setNeedsOnboarding(false);
      setAuthError(null);
    } catch (error) {
      console.error("Logout failed", error);
      throw error;
    }
  };

  // Derive centralized auth state
  let authState: AuthState = 'AUTH_LOADING';
  if (loading) {
    authState = 'AUTH_LOADING';
  } else if (authError) {
    authState = 'AUTH_ERROR';
  } else if (!user) {
    authState = 'UNAUTHENTICATED';
  } else if (needsOnboarding) {
    authState = 'PROFILE_INCOMPLETE';
  } else {
    authState = 'PROFILE_COMPLETE';
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      needsOnboarding, 
      authState,
      authError,
      loginWithGoogle, 
      completeOnboarding, 
      createUserProfile, 
      getUserProfile, 
      updateUserProfile, 
      deleteUserProfile, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


