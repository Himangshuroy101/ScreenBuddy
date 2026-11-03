import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Dimensions,
  NativeModules,
  NativeEventEmitter,
  TouchableOpacity,
  ScrollView,
  BackHandler,
} from 'react-native';
import { io, Socket } from 'socket.io-client';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
} from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'react-native-qrcode-svg';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import LottieView from 'lottie-react-native';

import { useTheme, ThemeColors } from '../theme';
import { SIGNALING_SERVER, ICE_CONFIGURATION, SOCKET_OPTIONS } from '../config';
import { usePreferences } from '../context/PreferencesContext';
import { useDataChannel } from '../hooks/useDataChannel';
import { useConnectionQuality } from '../hooks/useConnectionQuality';
import { addHelper, getAllFcmTokens, getHelperCount } from '../services/pairing';
import { saveSession } from '../services/sessionHistory';
import ConnectionBanner, { ConnectionStatus } from '../components/ConnectionBanner';
import SessionTimer from '../components/SessionTimer';
import ChatOverlay from '../components/ChatOverlay';
import QualityBadge from '../components/QualityBadge';
import type { BroadcasterScreenProps } from '../types/navigation';

const { PointerOverlay } = NativeModules;
const pointerEventEmitter = new NativeEventEmitter(PointerOverlay);

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function BroadcasterScreen({ route, navigation }: BroadcasterScreenProps) {
  const { mode } = route.params || {};

  const [roomId, setRoomId] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [helperCount, setHelperCount] = useState(0);
  const [hasPermissionError, setHasPermissionError] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showConsent, setShowConsent] = useState(mode !== 'sos');
  const [showSuccess, setShowSuccess] = useState(false);

  const roomIdRef = useRef('');
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localScreenStreamRef = useRef<any>(null);
  const localAudioStreamRef = useRef<any>(null);
  const pendingCandidates = useRef<any[]>([]);
  const sessionStartRef = useRef<Date | null>(null);

  const theme = useTheme();
  const styles = createStyles(theme);
  const { preferences } = usePreferences();

  // DataChannel for text chat
  const { messages, sendMessage, isChannelOpen, setupDataChannel } = useDataChannel();

  // Connection quality monitoring
  const connectionStats = useConnectionQuality(peerConnectionRef.current, isStreaming);

  // Track unread messages when chat is closed
  useEffect(() => {
    if (!isChatOpen && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.sender === 'peer') {
        setUnreadCount((c) => c + 1);
      }
    }
  }, [messages.length, isChatOpen]);

  const handleChatToggle = () => {
    setIsChatOpen((v) => !v);
    if (!isChatOpen) setUnreadCount(0); // Reset unread when opening
  };

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  // Android back button handling
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isChatOpen) {
        setIsChatOpen(false);
        return true;
      }
      if (isStreaming) {
        Alert.alert(
          'Stop Sharing?',
          'Are you sure you want to stop sharing your screen?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Yes, Stop',
              style: 'destructive',
              onPress: handleLeaveScreen,
            },
          ],
        );
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [isStreaming, isChatOpen]);

  useEffect(() => {
    PointerOverlay.requestOverlayPermission().then((hasPermission: boolean) => {
      if (!hasPermission) {
        Alert.alert('Action Required', 'Please enable "Draw over other apps".');
      }
    });

    socketRef.current = io(SIGNALING_SERVER, SOCKET_OPTIONS);
    const socket = socketRef.current;

    // Connection status tracking
    socket.on('connect', () => setConnectionStatus('connected'));
    socket.on('disconnect', () => setConnectionStatus('disconnected'));
    socket.on('reconnect_attempt', () => setConnectionStatus('reconnecting'));
    socket.on('reconnect', () => setConnectionStatus('connected'));
    socket.on('reconnect_failed', () => setConnectionStatus('error'));
    socket.on('connect_error', () => setConnectionStatus('error'));

    const setupRoom = async () => {
      let id = await AsyncStorage.getItem('DEVICE_ID');
      if (!id) {
        const { generateDeviceId } = require('../config');
        id = generateDeviceId();
        await AsyncStorage.setItem('DEVICE_ID', id!);
      }
      setRoomId(id!);
      socket.emit('join-room', id!);

      const count = await getHelperCount();
      setHelperCount(count);

      if (mode === 'sos' && count > 0) {
        console.log('SOS Mode Activated! Ringing all helpers...');
        const tokens = await getAllFcmTokens();
        tokens.forEach((token) => {
          socket.emit('trigger-sos', { targetToken: token, roomId: id });
        });
        startScreenShare();
      }
      // In adhoc mode, wait for the user to tap "Start Sharing" (consent screen)
    };

    setupRoom();

    socket.on('user-joined', async () => {
      console.log('Helper joined! Creating offer...');
      createOffer(roomIdRef.current);
    });

    socket.on('answer', async (answer: any) => {
      if (!answer || !answer.type || !answer.sdp) return;

      if (answer.fcmToken) {
        const added = await addHelper({
          fcmToken: answer.fcmToken,
          deviceId: roomIdRef.current,
          label: `Helper ${helperCount + 1}`,
        });
        if (added) {
          const newCount = await getHelperCount();
          setHelperCount(newCount);
          
          if (preferences.hapticEnabled) {
            ReactNativeHapticFeedback.trigger('notificationSuccess', {
              enableVibrateFallback: true,
              ignoreAndroidSystemSettings: false,
            });
          }
          
          setShowSuccess(true);
          setTimeout(() => {
            setShowSuccess(false);
          }, 3000);
        }
      }

      const remoteDesc = new RTCSessionDescription(answer);
      await peerConnectionRef.current?.setRemoteDescription(remoteDesc);

      pendingCandidates.current.forEach((c) =>
        peerConnectionRef.current?.addIceCandidate(new RTCIceCandidate(c)),
      );
      pendingCandidates.current = [];
    });

    socket.on('ice-candidate', async (candidate: any) => {
      if (candidate) {
        if (
          peerConnectionRef.current &&
          peerConnectionRef.current.remoteDescription
        ) {
          await peerConnectionRef.current
            .addIceCandidate(new RTCIceCandidate(candidate))
            .catch((e: any) => console.log(e));
        } else {
          pendingCandidates.current.push(candidate);
        }
      }
    });

    socket.on('draw-pointer', (coords: any) => {
      if (coords) PointerOverlay.updatePointer(coords.x, coords.y);
      else PointerOverlay.hidePointer();
    });

    const stopListener = pointerEventEmitter.addListener(
      'onStopSharing',
      () => handleLeaveScreen(),
    );

    return () => {
      PointerOverlay.stopOverlay();
      if (socketRef.current) socketRef.current.disconnect();
      stopStreaming();
      stopListener.remove();
    };
  }, []);

  const startScreenShare = async () => {
    try {
      setHasPermissionError(false);

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }

      peerConnectionRef.current = new RTCPeerConnection(ICE_CONFIGURATION as any);

      // Setup DataChannel for text chat (Broadcaster creates it)
      setupDataChannel(peerConnectionRef.current, 'broadcaster');

      (peerConnectionRef.current as any).onicecandidate = (event: any) => {
        if (event.candidate) {
          socketRef.current?.emit('ice-candidate', {
            roomId: roomIdRef.current,
            candidate: event.candidate,
          });
        }
      };

      (peerConnectionRef.current as any).ontrack = (event: any) => {
        console.log('Received track from Helper:', event.track.kind);
      };

      const screenStream = await (mediaDevices as any).getDisplayMedia({ video: true });
      localScreenStreamRef.current = screenStream;

      const audioStream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      localAudioStreamRef.current = audioStream;

      screenStream
        .getTracks()
        .forEach((track: any) =>
          peerConnectionRef.current?.addTrack(track, screenStream),
        );
      audioStream
        .getTracks()
        .forEach((track: any) =>
          peerConnectionRef.current?.addTrack(track, audioStream),
        );

      InCallManager.start({ media: 'video' });
      // Loudspeaker setting from preferences
      InCallManager.setForceSpeakerphoneOn(preferences.autoSpeaker);

      setIsStreaming(true);
      sessionStartRef.current = new Date();
      PointerOverlay.startOverlay();

      createOffer(roomIdRef.current);
    } catch (err) {
      console.error('Error sharing screen/audio:', err);
      setIsStreaming(false);
      setHasPermissionError(true);
    }
  };

  const createOffer = async (room: string) => {
    if (!peerConnectionRef.current) return;
    try {
      const offer = await (peerConnectionRef.current as any).createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      socketRef.current?.emit('offer', { roomId: room, offer });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  const stopStreaming = () => {
    if (localScreenStreamRef.current) {
      localScreenStreamRef.current.getTracks().forEach((track: any) => track.stop());
    }
    if (localAudioStreamRef.current) {
      localAudioStreamRef.current.getTracks().forEach((track: any) => track.stop());
    }
    if (peerConnectionRef.current) peerConnectionRef.current.close();
    InCallManager.stop();
    setIsStreaming(false);
    PointerOverlay.stopOverlay();
  };

  const handleLeaveScreen = async () => {
    if (preferences.hapticEnabled) {
      ReactNativeHapticFeedback.trigger('impactHeavy', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }

    // Save session history
    if (sessionStartRef.current) {
      const duration = (Date.now() - sessionStartRef.current.getTime()) / 1000;
      await saveSession(roomId || 'unknown', 'broadcaster', mode || 'adhoc', sessionStartRef.current, duration);
    }

    stopStreaming();
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const unpairDevice = async () => {
    if (preferences.hapticEnabled) {
      ReactNativeHapticFeedback.trigger('notificationWarning', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    navigation.navigate('ManageHelpers');
  };

  // Handler for consent screen "Start Sharing" button
  const handleConsentStart = () => {
    if (preferences.hapticEnabled) {
      ReactNativeHapticFeedback.trigger('impactMedium', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    setShowConsent(false);
    startScreenShare();
  };

  // ── Consent Screen (adhoc mode only) ──
  if (showConsent) {
    return (
      <View style={styles.container}>
        <ConnectionBanner status={connectionStatus} />
        <View style={styles.consentContainer}>
          <View style={styles.consentIconCircle}>
            <Icon name="monitor-share" size={56} color={theme.accent} />
          </View>
          <Text style={styles.consentTitle}>Ready to Share Your Screen?</Text>
          <Text style={styles.consentDescription}>
            Your helper will be able to see everything on your screen. They can guide you using a pointer and voice.
          </Text>

          <View style={styles.consentInfoCard}>
            <View style={styles.consentInfoRow}>
              <Icon name="eye-outline" size={20} color={theme.accent} />
              <Text style={styles.consentInfoText}>Your screen will be visible to your helper</Text>
            </View>
            <View style={styles.consentInfoRow}>
              <Icon name="microphone-outline" size={20} color={theme.accent} />
              <Text style={styles.consentInfoText}>Voice chat will be enabled</Text>
            </View>
            <View style={styles.consentInfoRow}>
              <Icon name="shield-check-outline" size={20} color={theme.success} />
              <Text style={styles.consentInfoText}>Only your paired helper can see it</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.consentButton}
            onPress={handleConsentStart}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Start sharing your screen"
          >
            <Icon name="play-circle-outline" size={22} color="#FFF" style={{ marginRight: 10 }} />
            <Text style={styles.consentButtonText}>Start Sharing</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.consentBackButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.consentBackText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ConnectionBanner status={connectionStatus} />
      <SessionTimer isActive={isStreaming} />
      {isStreaming && (
        <QualityBadge stats={connectionStats} visible={preferences.showQualityBadge} />
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Text style={styles.title}>
          {mode === 'sos' ? 'SOS Mode Active' : 'Device Pairing'}
        </Text>

        {/* QR Code Card */}
        <View style={styles.card}>
          <Text style={styles.label}>Your Permanent ID:</Text>
          <Text style={styles.roomIdText}>{roomId}</Text>

          {roomId && mode !== 'sos' && (
            <View style={styles.qrWrapper}>
              <QRCode
                value={JSON.stringify({ type: 'screenbuddy-pair', id: roomId })}
                size={150}
                logo={require('../assets/logo.png')}
                logoSize={40}
                logoBackgroundColor="#FFFFFF"
              />
            </View>
          )}
        </View>

        {/* Instructions Card */}
        <View style={styles.manualCard}>
          <Text style={styles.manualTitle}>
            {mode === 'sos' ? 'SOS Connection Status:' : 'How to connect:'}
          </Text>

          <View style={styles.stepRow}>
            <Icon
              name="numeric-1-circle"
              size={28}
              color={mode === 'sos' ? theme.danger : theme.accent}
            />
            <Text style={styles.stepText}>
              {isStreaming
                ? '✅ Screen recording started.'
                : "Accept the 'Start Recording' prompt on your screen."}
            </Text>
          </View>

          <View style={styles.stepRow}>
            <Icon
              name="numeric-2-circle"
              size={28}
              color={mode === 'sos' ? theme.danger : theme.accent}
            />
            <Text style={styles.stepText}>
              {mode === 'sos'
                ? `Ringing ${helperCount} helper(s)...`
                : 'Ask your helper to scan the QR code above.'}
            </Text>
          </View>

          <View style={styles.stepRow}>
            <Icon
              name="numeric-3-circle"
              size={28}
              color={mode === 'sos' ? theme.danger : theme.accent}
            />
            <Text style={styles.stepText}>
              Keep this screen open until they connect.
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          {hasPermissionError ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.retryButton]}
              onPress={startScreenShare}
              accessibilityRole="button"
              accessibilityLabel="Retry screen capture"
            >
              <Icon name="refresh" size={20} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>Retry Screen Capture</Text>
            </TouchableOpacity>
          ) : isStreaming ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.stopButton]}
              onPress={handleLeaveScreen}
              accessibilityRole="button"
              accessibilityLabel="Stop sharing"
            >
              <Icon name="stop-circle-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>Stop Sharing</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.loadingText}>Initializing screen capture...</Text>
          )}
        </View>

        {/* Manage Helpers Button */}
        {helperCount > 0 && (
          <TouchableOpacity
            style={styles.unpairButton}
            onPress={unpairDevice}
            accessibilityRole="button"
            accessibilityLabel="Manage paired helpers"
          >
            <Text style={styles.unpairText}>
              Manage Helpers ({helperCount})
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Chat Overlay — only visible when streaming */}
      {isStreaming && (
        <ChatOverlay
          messages={messages}
          onSend={sendMessage}
          isOpen={isChatOpen}
          onToggle={handleChatToggle}
          unreadCount={unreadCount}
          isChannelOpen={isChannelOpen}
        />
      )}

      {/* ── Success Overlay ── */}
      {showSuccess && (
        <View style={styles.successOverlay}>
          <LottieView
            source={require('../assets/success.json')}
            autoPlay
            loop={false}
            style={styles.lottieAnim}
          />
          <Text style={styles.successText}>Helper Paired Successfully!</Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      padding: 0,
      backgroundColor: theme.background,
      paddingTop: 20,
    },
    scrollContent: {
      alignItems: 'center',
      padding: 20,
      paddingTop: 20,
      paddingBottom: 80,
      backgroundColor: theme.background,
    },
    title: {
      fontSize: 28,
      fontWeight: '900',
      color: theme.text,
      marginBottom: 20,
    },
    card: {
      backgroundColor: theme.card,
      padding: 25,
      borderRadius: 20,
      width: '100%',
      alignItems: 'center',
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 5,
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    roomIdText: {
      fontSize: 30,
      fontWeight: 'bold',
      letterSpacing: 4,
      color: theme.accent,
      marginTop: 5,
    },
    qrWrapper: {
      marginTop: 25,
      padding: 15,
      backgroundColor: '#FFFFFF',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    manualCard: {
      backgroundColor: theme.card,
      padding: 20,
      borderRadius: 20,
      width: '100%',
      marginBottom: 30,
      borderWidth: 1,
      borderColor: theme.border,
    },
    manualTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 15,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    stepText: {
      fontSize: 15,
      color: theme.text,
      marginLeft: 12,
      flex: 1,
      lineHeight: 22,
    },
    buttonContainer: { width: '100%', marginTop: 10 },
    actionButton: {
      flexDirection: 'row',
      paddingVertical: 18,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    retryButton: { backgroundColor: theme.warning, shadowColor: theme.warning },
    stopButton: { backgroundColor: theme.danger, shadowColor: theme.danger },
    buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
    loadingText: {
      textAlign: 'center',
      color: theme.textSecondary,
      fontSize: 16,
      fontStyle: 'italic',
    },
    unpairButton: { marginTop: 30, paddingVertical: 10, paddingHorizontal: 20 },
    unpairText: {
      color: theme.accent,
      fontSize: 14,
      fontWeight: 'bold',
      textDecorationLine: 'underline',
    },

    // ── Consent Screen ──
    consentContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 30,
      paddingTop: 60,
    },
    consentIconCircle: {
      width: 110,
      height: 110,
      borderRadius: 55,
      backgroundColor: theme.accent + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    consentTitle: {
      fontSize: 26,
      fontWeight: '900',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    consentDescription: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 28,
      paddingHorizontal: 10,
    },
    consentInfoCard: {
      width: '100%',
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 32,
      borderWidth: 1,
      borderColor: theme.border,
    },
    consentInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
      width: '100%',
    },
    consentInfoText: {
      fontSize: 15,
      color: theme.text,
      marginLeft: 14,
      flexShrink: 1,
      lineHeight: 21,
    },
    consentButton: {
      flexDirection: 'row',
      backgroundColor: theme.accent,
      paddingVertical: 18,
      paddingHorizontal: 40,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 6,
    },
    consentButtonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: 'bold',
    },
    consentBackButton: {
      marginTop: 20,
      paddingVertical: 12,
      paddingHorizontal: 24,
    },
    consentBackText: {
      color: theme.textSecondary,
      fontSize: 16,
      fontWeight: '600',
    },
    successOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 999,
    },
    lottieAnim: {
      width: 250,
      height: 250,
    },
    successText: {
      color: '#FFFFFF',
      fontSize: 22,
      fontWeight: 'bold',
      marginTop: -20,
    },
  });
