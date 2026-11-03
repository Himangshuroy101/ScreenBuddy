import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSIONS_KEY = '@screenbuddy_sessions';
const MAX_SESSIONS = 100;

export interface SessionRecord {
  id: string;
  peerDeviceId: string;
  role: 'broadcaster' | 'helper';
  mode: 'sos' | 'adhoc';
  startedAt: string; // ISO timestamp
  duration: number;  // seconds
}

/**
 * Generate a simple unique ID for session records.
 */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

/**
 * Saves a new session record. Auto-evicts oldest when exceeding MAX_SESSIONS.
 */
export async function saveSession(
  peerDeviceId: string,
  role: 'broadcaster' | 'helper',
  mode: 'sos' | 'adhoc',
  startedAt: Date,
  duration: number,
): Promise<void> {
  try {
    const record: SessionRecord = {
      id: generateId(),
      peerDeviceId,
      role,
      mode,
      startedAt: startedAt.toISOString(),
      duration: Math.round(duration),
    };

    const existing = await getSessions();
    const updated = [record, ...existing].slice(0, MAX_SESSIONS);
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('[SessionHistory] Failed to save:', e);
  }
}

/**
 * Returns all session records, newest first.
 */
export async function getSessions(): Promise<SessionRecord[]> {
  try {
    const stored = await AsyncStorage.getItem(SESSIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('[SessionHistory] Failed to load:', e);
    return [];
  }
}

/**
 * Clears all session history.
 */
export async function clearSessions(): Promise<void> {
  await AsyncStorage.removeItem(SESSIONS_KEY);
}
