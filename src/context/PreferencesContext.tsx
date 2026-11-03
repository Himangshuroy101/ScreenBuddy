import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFS_KEY = '@screenbuddy_preferences';

export interface Preferences {
  darkModeOverride: 'system' | 'light' | 'dark';
  hapticEnabled: boolean;
  autoSpeaker: boolean;
  showQualityBadge: boolean;
}

const DEFAULT_PREFERENCES: Preferences = {
  darkModeOverride: 'system',
  hapticEnabled: true,
  autoSpeaker: true, // Loudspeaker ON by default
  showQualityBadge: true,
};

interface PreferencesContextType {
  preferences: Preferences;
  updatePreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  isLoading: boolean;
}

const PreferencesContext = createContext<PreferencesContextType>({
  preferences: DEFAULT_PREFERENCES,
  updatePreference: () => {},
  isLoading: true,
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(PREFS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
        }
      } catch (e) {
        console.error('[Preferences] Failed to load:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const updatePreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(console.error);
      return next;
    });
  };

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreference, isLoading }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextType {
  return useContext(PreferencesContext);
}
