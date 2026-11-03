import AsyncStorage from '@react-native-async-storage/async-storage';

const HELPERS_KEY = '@screenbuddy_paired_helpers';
const LEGACY_KEY = 'PAIRED_HELPER_ID'; // Old single-helper key
const MAX_HELPERS = 3;

export interface PairedHelper {
  fcmToken: string;
  deviceId: string;
  pairedAt: string; // ISO timestamp
  label?: string;   // User-assigned nickname
}

/**
 * Migrates from the old single PAIRED_HELPER_ID to the new array format.
 * Called internally on first read.
 */
async function migrateIfNeeded(): Promise<void> {
  try {
    const legacyToken = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacyToken) {
      const existing = await AsyncStorage.getItem(HELPERS_KEY);
      if (!existing) {
        const migrated: PairedHelper[] = [
          {
            fcmToken: legacyToken,
            deviceId: 'Unknown',
            pairedAt: new Date().toISOString(),
            label: 'Helper 1',
          },
        ];
        await AsyncStorage.setItem(HELPERS_KEY, JSON.stringify(migrated));
      }
      await AsyncStorage.removeItem(LEGACY_KEY);
    }
  } catch (e) {
    console.error('[Pairing] Migration failed:', e);
  }
}

/**
 * Returns all paired helpers.
 */
export async function getHelpers(): Promise<PairedHelper[]> {
  await migrateIfNeeded();
  try {
    const stored = await AsyncStorage.getItem(HELPERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('[Pairing] Failed to load helpers:', e);
    return [];
  }
}

/**
 * Adds a new helper. Returns false if max reached or already paired.
 */
export async function addHelper(helper: Omit<PairedHelper, 'pairedAt'>): Promise<boolean> {
  const existing = await getHelpers();

  // Check for duplicates
  if (existing.some((h) => h.fcmToken === helper.fcmToken)) {
    return true; // Already paired, no-op
  }

  if (existing.length >= MAX_HELPERS) {
    return false; // Max reached
  }

  const newHelper: PairedHelper = {
    ...helper,
    pairedAt: new Date().toISOString(),
  };

  const updated = [...existing, newHelper];
  await AsyncStorage.setItem(HELPERS_KEY, JSON.stringify(updated));

  // Also keep the legacy key updated for backward compat with signaling server
  await AsyncStorage.setItem(LEGACY_KEY, helper.fcmToken);

  return true;
}

/**
 * Removes a helper by FCM token.
 */
export async function removeHelper(fcmToken: string): Promise<void> {
  const existing = await getHelpers();
  const updated = existing.filter((h) => h.fcmToken !== fcmToken);
  await AsyncStorage.setItem(HELPERS_KEY, JSON.stringify(updated));

  // Update legacy key
  if (updated.length > 0) {
    await AsyncStorage.setItem(LEGACY_KEY, updated[0].fcmToken);
  } else {
    await AsyncStorage.removeItem(LEGACY_KEY);
  }
}

/**
 * Clears all paired helpers.
 */
export async function clearHelpers(): Promise<void> {
  await AsyncStorage.removeItem(HELPERS_KEY);
  await AsyncStorage.removeItem(LEGACY_KEY);
}

/**
 * Returns the count of paired helpers.
 */
export async function getHelperCount(): Promise<number> {
  const helpers = await getHelpers();
  return helpers.length;
}

/**
 * Returns all FCM tokens for SOS broadcast.
 */
export async function getAllFcmTokens(): Promise<string[]> {
  const helpers = await getHelpers();
  return helpers.map((h) => h.fcmToken);
}
