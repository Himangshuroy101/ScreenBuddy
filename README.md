# ScreenBuddy 📱🤝

> **Family tech support, simplified.**  
> A real-time screen sharing and remote guidance application built with React Native and WebRTC, specifically designed for older family members who need hands-on assistance navigating their mobile phones.

---

## 🌟 The Vision

Smartphone technology evolves rapidly, leaving many senior and less tech-savvy family members feeling isolated or frustrated when dealing with modern mobile apps—from online banking and government portals to adjusting phone settings and troubleshooting everyday apps.

Trying to guide an elderly parent or grandparent over a standard phone call is often painful:
> *"What do you see on your screen now?"*  
> *"There's a blue icon."*  
> *"Which blue icon? At the top or bottom?"*  
> *"I tapped it and everything vanished!"*

**ScreenBuddy** solves this by providing:
1. **One-Tap SOS Assistance**: Seniors tap one large, high-contrast button to instantly ring their trusted family helper(s).
2. **Real-Time Low-Latency Screen Sharing**: Helpers see exactly what is on the elder's screen in real time via WebRTC.
3. **Remote Visual Laser Pointer**: Helpers tap or drag on their screen, rendering a prominent visual pointer directly over third-party apps on the senior's phone to show them exactly where to tap.
4. **Hands-Free Audio**: Automatic two-way voice with loudspeaker enabled by default.
5. **Senior Safety & Privacy First**: A native floating "Stop" button is always present on the elder's screen, giving them full control to terminate sharing at any moment.

---

## ✨ Features

- 🆘 **One-Touch SOS Alert**: Wakes up paired helper phones with high-priority Google FCM push notifications (bypassing Android Doze mode).
- 📡 **WebRTC Screen & Audio Streaming**: Sub-second latency P2P video and audio streaming with automatic ICE/TURN fallback.
- 🔴 **System-Level Pointer Overlay**: Native Android service (`TYPE_APPLICATION_OVERLAY`) that draws over any app without blocking the senior's touches (`FLAG_NOT_TOUCHABLE`).
- 🛑 **Draggable Floating Stop Button**: Always-on-top draggable safety button allowing seniors to stop the broadcast with one tap and a confirmation prompt.
- 🔊 **Auto-Loudspeaker**: Automated loudspeaker routing via `react-native-incall-manager` so seniors don't have to alternate between their ear and screen.
- 🔗 **QR Code & Room Code Pairing**: Fast pairing via camera QR scanning or a simple 6-10 character alphanumeric code. Supports pairing up to 3 trusted helpers.
- 💬 **In-Session P2P Chat**: WebRTC DataChannel for silent text messaging during screen sharing.
- 📊 **Connection Quality Monitor**: Live RTT, bitrate, packet loss, and jitter diagnostics.
- 📜 **Session History**: Local log tracking past sessions, durations, and peer IDs.
- 🌓 **Elderly-Friendly UI**: High-contrast theme tokens, dynamic curved notch bottom tabs, haptic feedback, and large accessibility-friendly touch targets.

---

## 🏗️ Architecture

```
┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
│     Elderly Phone (Broadcaster) │                 │       Helper Phone (Viewer)     │
│                                 │                 │                                 │
│  • React Native UI              │                 │  • React Native UI              │
│  • MediaProjection Video Track  │                 │  • RTCView Video Display        │
│  • Microphone Audio Track       │                 │  • Touch Event Capture          │
│  • Native PointerOverlayService │                 │  • Camera QR Code Scanner       │
└────────────────┬────────────────┘                 └────────────────▲────────────────┘
                 │                                                   │
                 │ 1. SOS Push Trigger                               │ 3. Wakes Up / Connects
                 ▼                                                   │
         ┌───────────────────────────────────────────────────────────┴┐
         │             Signaling & Push Server (Node.js)              │
         │  • Socket.IO Hub (Room Routing & ICE Exchange)             │
         │  • Firebase Admin SDK (High-Priority Push Delivery)        │
         │  • Rate Limiting & Room ID Sanitization                    │
         └───────────────────────────────┬────────────────────────────┘
                                         │
                                         ▼ 4. P2P WebRTC Connection
                      ┌──────────────────────────────────────┐
                      │    Direct Peer-to-Peer Connection    │
                      │  • Video: Screen Stream              │
                      │  • Audio: Bidirectional Voice        │
                      │  • DataChannel: Live Text Chat       │
                      │  • Socket/P2P: Pointer Coordinates   │
                      └──────────────────────────────────────┘
```

---

## 📁 Repository Structure

```text
ScreenBuddy/
├── android/                    # Android native project
│   └── app/src/main/java/com/screenbuddy/
│       ├── MainActivity.kt             # MediaProjection setup
│       ├── MainApplication.kt          # Native package registration
│       ├── PointerModule.kt            # React Native bridge for overlay
│       ├── PointerOverlayService.kt    # Android Foreground Service & floating views
│       └── PointerPackage.kt           # Native package definition
├── ios/                        # iOS project configurations
├── screenbuddy-server/         # Node.js signaling & push server
│   ├── index.js                # Express + Socket.IO + Firebase Admin
│   ├── package.json            # Server dependencies
│   ├── serviceAccountKey.example.json  # Template for Firebase credentials
│   └── .gitignore              # Ignores secrets & node_modules
├── src/                        # Main React Native TypeScript codebase
│   ├── assets/                 # Icons, logo, and animations
│   ├── components/             # Reusable UI (ChatOverlay, StyledButton, etc.)
│   ├── config/                 # Signaling URL, ICE servers, device ID helper
│   ├── context/                # PreferencesContext (theme, haptics, loudspeaker)
│   ├── hooks/                  # useSocket, useDataChannel, useConnectionQuality
│   ├── navigation/             # MainTabs (curved notch tab bar) & Stack Navigator
│   ├── screens/                # Core screens (HomeScreen, Broadcaster, Helper, etc.)
│   ├── services/               # Pairing & Session History AsyncStorage services
│   ├── theme/                  # Design tokens (light / dark)
│   └── types/                  # Navigation & data TypeScript types
├── App.tsx                     # App root entry point with ErrorBoundary
├── index.js                    # React Native AppRegistry entry
└── package.json                # Project dependencies and scripts
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `>= 22.11.0`
- **npm** or **yarn**
- **Android Studio** with:
  - Android SDK Platform `36` (Target SDK 36, Min SDK 24)
  - Android NDK `27.1.12297006`
  - Android SDK Build-Tools `36.0.0`
- A physical Android device is strongly recommended for testing screen sharing and overlay permissions.

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/<your-username>/ScreenBuddy.git
cd ScreenBuddy
npm install
```

---

### Step 2: Configure the Signaling Server

1. Navigate to `screenbuddy-server`:
   ```bash
   cd screenbuddy-server
   npm install
   ```

2. **Add Firebase Service Account Key**:
   - Go to your [Firebase Console](https://console.firebase.google.com/) > Project Settings > Service accounts.
   - Click **Generate new private key** and download the JSON file.
   - Place this file in `screenbuddy-server/serviceAccountKey.json` (format matches `serviceAccountKey.example.json`).

3. **Start the Signaling Server**:
   ```bash
   node index.js
   ```
   *The signaling server runs on port `3000` by default.*

---

### Step 3: Configure the Client App

1. **Set Signaling Server IP**:
   Open `src/config/index.ts` and set your local machine's LAN IP or deployed domain:
   ```typescript
   export const SIGNALING_SERVER: string = __DEV__
     ? 'http://<YOUR_LOCAL_IP>:3000' // e.g., 'http://192.168.1.100:3000' (or 10.0.2.2 for Android emulator)
     : 'https://your-signaling-domain.com';
   ```

2. **Add Firebase `google-services.json`**:
   - Download `google-services.json` from your Firebase project for package `com.screenbuddy`.
   - Place it in `android/app/google-services.json`.

---

### Step 4: Run the App on Android

In the project root:

```bash
# Start Metro Bundler
npm start

# In a new terminal, build & install the Android app
npm run android
```

---

## 🔒 Permissions Used

| Permission | Purpose |
| :--- | :--- |
| `SYSTEM_ALERT_WINDOW` | Renders the remote laser pointer dot and floating "Stop" button over any app |
| `FOREGROUND_SERVICE_MEDIA_PROJECTION` | Keeps screen capture alive when the elder switches to other apps |
| `CAMERA` | Scans helper pairing QR codes |
| `RECORD_AUDIO` | Two-way voice communication during support sessions |
| `POST_NOTIFICATIONS` | High-priority SOS push alerts on Android 13+ |
| `WAKE_LOCK` | Wakes the helper device when an urgent SOS arrives |

---

## 🛡️ Privacy & Security

- **P2P Direct Stream**: Video and audio are transmitted peer-to-peer via WebRTC and encrypted using DTLS/SRTP. No video frames are recorded or saved on any server.
- **Explicit Senior Consent**: Screen broadcasting requires user confirmation on system dialogs before any pixels leave the device.
- **Draggable Stop Button**: The elder can tap the always-visible on-screen floating button to abort the session instantly.

---

## 🗺️ Roadmap

- [ ] Automatic Aspect-Ratio Letterbox Touch Calibration for varying screen resolutions
- [ ] First-to-claim SOS Room Locking for multi-helper families
- [ ] Visual Arrow & Shape Drawing Mode in addition to the single laser dot
- [ ] Dedicated Coturn Server integration for restrictive firewall traversal
- [ ] iOS Broadcast Upload Extension for full iOS screen sharing support

---

## 👨‍💻 Author

**Himangshu Roy**
- LinkedIn: [Himangshu Roy](https://www.linkedin.com/in/himangshuroy101)
- GitHub: [@Himangshuroy101](https://github.com/Himangshuroy101)

---

## 📄 License

This project is licensed under the MIT License.
