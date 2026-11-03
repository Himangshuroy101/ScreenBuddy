const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// --- 1. IMPORT & INITIALIZE FIREBASE ADMIN ---
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Ensure this file is in the same folder!

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();
app.use(cors());

const server = http.createServer(app);

// ──────────────────────────────────────────────
// CORS: Restrict WebSocket connections
// In production, replace with your actual domain/app identifiers
// ──────────────────────────────────────────────
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:8081']; // Dev only — React Native Metro bundler

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow connections with no origin (mobile apps, curl, etc.)
      // In production, you can tighten this further with auth tokens
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
  },
});

// ──────────────────────────────────────────────
// Rate Limiting (per-socket, in-memory)
// ──────────────────────────────────────────────
const RATE_LIMITS = {
  'join-room':   { max: 5,  windowMs: 60_000 },  // 5 joins per minute
  'trigger-sos': { max: 3,  windowMs: 60_000 },  // 3 SOS per minute
};

/**
 * Simple per-socket rate limiter.
 * Returns true if the action is allowed, false if rate-limited.
 */
function checkRateLimit(socket, action) {
  const config = RATE_LIMITS[action];
  if (!config) return true;

  if (!socket._rateLimits) socket._rateLimits = {};
  if (!socket._rateLimits[action]) {
    socket._rateLimits[action] = { count: 0, resetAt: Date.now() + config.windowMs };
  }

  const bucket = socket._rateLimits[action];
  const now = Date.now();

  // Reset window if expired
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + config.windowMs;
  }

  bucket.count++;
  if (bucket.count > config.max) {
    console.warn(`[RateLimit] Socket ${socket.id} exceeded ${action} limit (${config.max}/${config.windowMs}ms)`);
    return false;
  }

  return true;
}

// ──────────────────────────────────────────────
// Room ID Validation
// Only allow 6-12 character alphanumeric IDs
// ──────────────────────────────────────────────
const ROOM_ID_REGEX = /^[A-Z0-9]{6,12}$/i;

function isValidRoomId(roomId) {
  return typeof roomId === 'string' && ROOM_ID_REGEX.test(roomId);
}

// ──────────────────────────────────────────────
// Socket.IO Event Handlers
// ──────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join-room', (roomId) => {
    // Validate room ID format
    if (!isValidRoomId(roomId)) {
      socket.emit('error-message', { code: 'INVALID_ROOM', message: 'Invalid room ID format.' });
      return;
    }

    // Rate limit
    if (!checkRateLimit(socket, 'join-room')) {
      socket.emit('error-message', { code: 'RATE_LIMITED', message: 'Too many join attempts. Please wait.' });
      return;
    }

    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
    socket.to(roomId).emit('user-joined', socket.id);
  });

  socket.on('offer', (data) => {
    if (!data || !isValidRoomId(data.roomId)) return;
    socket.to(data.roomId).emit('offer', data.offer);
  });

  socket.on('answer', (data) => {
    if (!data || !isValidRoomId(data.roomId)) return;
    socket.to(data.roomId).emit('answer', data.answer);
  });

  socket.on('ice-candidate', (data) => {
    if (!data || !isValidRoomId(data.roomId)) return;
    socket.to(data.roomId).emit('ice-candidate', data.candidate);
  });

  socket.on('draw-pointer', (data) => {
    if (!data || !isValidRoomId(data.roomId)) return;
    socket.to(data.roomId).emit('draw-pointer', data.coordinates);
  });

  // --- SOS TRIGGER ---
  socket.on('trigger-sos', async (data) => {
    // Validate payload
    if (!data || !data.targetToken || !isValidRoomId(data.roomId)) {
      socket.emit('error-message', { code: 'INVALID_SOS', message: 'Invalid SOS payload.' });
      return;
    }

    // Rate limit
    if (!checkRateLimit(socket, 'trigger-sos')) {
      socket.emit('error-message', { code: 'RATE_LIMITED', message: 'Too many SOS attempts. Please wait.' });
      return;
    }

    console.log(`SOS Triggered for Room: ${data.roomId}`);

    try {
      const message = {
        token: data.targetToken,
        notification: {
          title: '🆘 Urgent: Help Needed!',
          body: 'Your family member needs screen support. Tap to connect instantly.',
        },
        data: {
          roomId: data.roomId,
          type: 'sos-alert'
        },
        android: {
          priority: 'high', // CRITICAL: This wakes up Android from Doze mode
        }
      };

      // Send the high-priority push notification via Google's servers
      const response = await admin.messaging().send(message);
      console.log('Successfully woke up Helper phone:', response);

    } catch (error) {
      console.error('Error sending SOS push notification:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});