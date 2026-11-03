/**
 * Centralized app configuration.
 * All server URLs, WebRTC settings, and environment-specific values live here.
 */

// ──────────────────────────────────────────────
// Signaling Server
// ──────────────────────────────────────────────
export const SIGNALING_SERVER: string = __DEV__
  ? 'http://192.168.29.128:3000' // Local dev machine
  : 'https://signal.screenbuddy.app'; // TODO: Replace with production URL

// ──────────────────────────────────────────────
// Privacy Policy
// ──────────────────────────────────────────────
// TODO: Replace with your hosted privacy policy URL before Play Store submission.
// You can host a simple page on GitHub Pages, Firebase Hosting, or any static host.
export const PRIVACY_POLICY_URL: string = '';  // e.g. 'https://screenbuddy.app/privacy'

// ──────────────────────────────────────────────
// WebRTC ICE Configuration
// Uses Google STUN + Metered free TURN relay
// ──────────────────────────────────────────────
export const ICE_CONFIGURATION = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Free TURN servers from Open Relay (metered.ca)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

// ──────────────────────────────────────────────
// Device ID Generation
// ──────────────────────────────────────────────

/**
 * Generate a cryptographically stronger random device ID.
 * Falls back to Math.random() if crypto is not available.
 */
export function generateDeviceId(): string {
  try {
    const array = new Uint8Array(6);
    // @ts-ignore — globalThis.crypto exists in modern RN hermes
    (globalThis.crypto || crypto).getRandomValues(array);
    return Array.from(array, (b) => b.toString(36).padStart(2, '0'))
      .join('')
      .toUpperCase()
      .slice(0, 10);
  } catch {
    // Fallback for older engines
    return Math.random().toString(36).substring(2, 12).toUpperCase();
  }
}

// ──────────────────────────────────────────────
// Socket.IO Reconnection Options
// ──────────────────────────────────────────────
export const SOCKET_OPTIONS = {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
  timeout: 20000,
};
