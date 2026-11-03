import { useColorScheme } from 'react-native';
import { usePreferences } from '../context/PreferencesContext';

/**
 * ScreenBuddy Design Tokens
 *
 * Every color in the app references these tokens instead of raw hex values.
 * The `useTheme()` hook auto-selects light or dark based on the OS setting
 * OR the user's override from Settings.
 */

export interface ThemeColors {
  // Backgrounds
  background: string;
  surface: string;
  card: string;

  // Text
  text: string;
  textSecondary: string;
  textInverse: string;

  // Accents
  accent: string;
  danger: string;
  warning: string;
  success: string;

  // Borders & Dividers
  border: string;
  divider: string;

  // Specific UI
  sosCardBg: string;
  sosCardBorder: string;
  sosIconBg: string;
  helperCardBg: string;
  helperIconBg: string;
  modalOverlay: string;
  inputBg: string;
  badgeBg: string;
  shadowColor: string;
}

export const lightTheme: ThemeColors = {
  background: '#F4F7F6',
  surface: '#FFFFFF',
  card: '#FFFFFF',

  text: '#1C1C1E',
  textSecondary: '#8E8E93',
  textInverse: '#FFFFFF',

  accent: '#007AFF',
  danger: '#FF3B30',
  warning: '#FF9500',
  success: '#34C759',

  border: '#E5E5EA',
  divider: '#E5E5EA',

  sosCardBg: '#FFFFFF',
  sosCardBorder: '#FFEBEB',
  sosIconBg: '#FFF0F0',
  helperCardBg: '#1C1C1E',
  helperIconBg: '#2C2C2E',
  modalOverlay: 'rgba(0,0,0,0.5)',
  inputBg: '#FFFFFF',
  badgeBg: '#E5E5EA',
  shadowColor: '#000000',
};

export const darkTheme: ThemeColors = {
  background: '#000000',
  surface: '#1C1C1E',
  card: '#2C2C2E',

  text: '#FFFFFF',
  textSecondary: '#8E8E93',
  textInverse: '#1C1C1E',

  accent: '#0A84FF',
  danger: '#FF453A',
  warning: '#FF9F0A',
  success: '#30D158',

  border: '#38383A',
  divider: '#38383A',

  sosCardBg: '#1C1C1E',
  sosCardBorder: '#3A1A1A',
  sosIconBg: '#2C1515',
  helperCardBg: '#2C2C2E',
  helperIconBg: '#3A3A3C',
  modalOverlay: 'rgba(0,0,0,0.7)',
  inputBg: '#2C2C2E',
  badgeBg: '#2C2C2E',
  shadowColor: '#000000',
};

/**
 * Auto-selects light or dark theme.
 * Checks the user's override from Settings first, then falls back to OS setting.
 */
export function useTheme(): ThemeColors {
  const systemScheme = useColorScheme();

  // Try to get user preference — wrapped in try/catch for the case
  // where PreferencesProvider isn't mounted yet (e.g. ErrorBoundary)
  let override: 'system' | 'light' | 'dark' = 'system';
  try {
    const { preferences } = usePreferences();
    override = preferences.darkModeOverride;
  } catch {
    // PreferencesContext not available, use system
  }

  const effectiveScheme =
    override === 'system' ? systemScheme : override;

  return effectiveScheme === 'dark' ? darkTheme : lightTheme;
}
