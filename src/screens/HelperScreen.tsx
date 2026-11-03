import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Dimensions,
  TouchableOpacity,
  Animated,
  BackHandler,
} from 'react-native';
import { io, Socket } from 'socket.io-client';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  RTCView,
  mediaDevices,
} from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import { Camera } from 'react-native-camera-kit';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { BlurView } from '@react-native-community/blur';
import { getMessaging, getToken, requestPermission } from '@react-native-firebase/messaging';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import { useTheme, ThemeColors } from '../theme';
import { SIGNALING_SERVER, ICE_CONFIGURATION, SOCKET_OPTIONS } from '../config';
import { usePreferences } from '../context/PreferencesContext';
import { useDataChannel } from '../hooks/useDataChannel';
import { useConnectionQuality } from '../hooks/useConnectionQuality';
import { saveSession } from '../services/sessionHistory';
import ConnectionBanner, { ConnectionStatus } from '../components/ConnectionBanner';
import SessionTimer from '../components/SessionTimer';
import StyledButton from '../components/StyledButton';
import ChatOverlay from '../components/ChatOverlay';
import QualityBadge from '../components/QualityBadge';
import type { HelperScreenProps } from '../types/navigation';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function HelperScreen({ route, navigation }: HelperScreenProps) {
  const [roomId, setRoomId] = useState('');
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [inputError, setInputError] = useState('');

  const theme = useTheme();
  const styles = createStyles(theme);
  const { preferences } = usePreferences();

  // DataChannel for text chat
  const { messages, sendMessage, isChannelOpen, setupDataChannel } = useDataChannel();

  // Connection quality monitoring
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const connectionStats = useConnectionQuality(peerConnectionRef.current, !!remoteStream);

  // Laser animation for QR scanner
  const laserAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isScanning) {
      laserAnim.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 280,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      laserAnim.stopAnimation();
    }
  }, [isScanning, laserAnim]);

  const roomIdRef = useRef('');
  const socketRef = useRef<Socket | null>(null);
  const localAudioStreamRef = useRef<any>(null);
  const pendingCandidates = useRef<any[]>([]);
  const sessionStartRef = useRef<Date | null>(null);
  const joinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (!isChatOpen) setUnreadCount(0);
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
      if (remoteStream) {
        Alert.alert(
          'Disconnect?',
          'Are you sure you want to disconnect from the session?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Yes, Disconnect',
              style: 'destructive',
              onPress: () => {
                disconnectCall();
                navigation.goBack();
              },
            },
          ],
        );
        return true;
      }
      if (isScanning) {
        setIsScanning(false);
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [remoteStream, isScanning, isChatOpen, navigation]);

  useEffect(() => {
    socketRef.current = io(SIGNALING_SERVER, SOCKET_OPTIONS);
    const socket = socketRef.current;

    socket.on('connect', () => setConnectionStatus('connected'));
    socket.on('disconnect', () => setConnectionStatus('disconnected'));
    socket.on('reconnect_attempt', () => setConnectionStatus('reconnecting'));
    socket.on('reconnect', () => setConnectionStatus('connected'));
    socket.on('reconnect_failed', () => setConnectionStatus('error'));
    socket.on('connect_error', () => setConnectionStatus('error'));

    socket.on('offer', async (offer: any) => {
      await handleReceiveOffer(offer);
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

    return () => { disconnectCall(); };
  }, []);

  // Auto-join from push notification or deep link
  useEffect(() => {
    const params = route.params;
    const autoJoinRoomId = params?.autoJoinRoomId;
    if (autoJoinRoomId) {
      console.log('Auto-joining SOS Room:', autoJoinRoomId);
      setRoomId(autoJoinRoomId);
      roomIdRef.current = autoJoinRoomId;
      joinRoom(autoJoinRoomId);
    }
  }, [route.params]);

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const joinRoom = (overrideId: string | null = null) => {
    const targetRoom = (overrideId || roomId).trim();

    // Validate input
    if (!targetRoom) {
      setInputError('Please enter a device ID or code.');
      triggerShake();
      if (preferences.hapticEnabled) {
        ReactNativeHapticFeedback.trigger('notificationError', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      }
      return;
    }

    if (targetRoom.length < 6) {
      setInputError('ID must be at least 6 characters.');
      triggerShake();
      if (preferences.hapticEnabled) {
        ReactNativeHapticFeedback.trigger('notificationError', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      }
      return;
    }

    if (!/^[A-Z0-9]+$/i.test(targetRoom)) {
      setInputError('Only letters and numbers are allowed.');
      triggerShake();
      if (preferences.hapticEnabled) {
        ReactNativeHapticFeedback.trigger('notificationError', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      }
      return;
    }

    setInputError('');
    if (preferences.hapticEnabled) {
      ReactNativeHapticFeedback.trigger('impactMedium', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    socketRef.current?.emit('join-room', targetRoom);
    setIsConnected(true);
    sessionStartRef.current = new Date();

    // Timeout: if no offer arrives within 30s, reset and show error
    if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
    joinTimeoutRef.current = setTimeout(() => {
      // Only reset if we're still waiting (no remoteStream yet)
      if (!peerConnectionRef.current?.remoteDescription) {
        setIsConnected(false);
        setInputError('No device found with this code. Please check and try again.');
        triggerShake();
        if (preferences.hapticEnabled) {
          ReactNativeHapticFeedback.trigger('notificationWarning', {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
          });
        }
      }
    }, 30_000);
  };

  const handleReceiveOffer = async (offer: any) => {
    if (!offer || !offer.type || !offer.sdp) return;

    // Offer received — cancel the join timeout
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current);
      joinTimeoutRef.current = null;
    }

    try {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }

      peerConnectionRef.current = new RTCPeerConnection(ICE_CONFIGURATION as any);

      // Setup DataChannel for text chat (Helper receives it)
      setupDataChannel(peerConnectionRef.current, 'helper');

      (peerConnectionRef.current as any).ontrack = (event: any) => {
        if (event.track.kind === 'video' && event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      (peerConnectionRef.current as any).onicecandidate = (event: any) => {
        if (event.candidate) {
          socketRef.current?.emit('ice-candidate', {
            roomId: roomIdRef.current,
            candidate: event.candidate,
          });
        }
      };

      (peerConnectionRef.current as any).onconnectionstatechange = () => {
        const state = peerConnectionRef.current?.connectionState;
        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          Alert.alert(
            'Session Ended',
            'The other device has stopped sharing their screen.',
            [
              {
                text: 'OK',
                onPress: () => {
                  disconnectCall(true);
                },
              },
            ]
          );
        }
      };

      const audioStream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      localAudioStreamRef.current = audioStream;

      audioStream.getTracks().forEach((track: any) => {
        peerConnectionRef.current?.addTrack(track, audioStream);
      });

      InCallManager.start({ media: 'video' });
      // Loudspeaker setting from preferences
      InCallManager.setForceSpeakerphoneOn(preferences.autoSpeaker);

      const remoteDesc = new RTCSessionDescription(offer);
      await peerConnectionRef.current.setRemoteDescription(remoteDesc);

      pendingCandidates.current.forEach((c) =>
        peerConnectionRef.current?.addIceCandidate(new RTCIceCandidate(c)),
      );
      pendingCandidates.current = [];

      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      let fcmToken: string | null = null;
      try {
        const messagingInstance = getMessaging();
        await requestPermission(messagingInstance);
        fcmToken = await getToken(messagingInstance);
      } catch (e) {
        console.log('FCM Permission denied', e);
      }

      const answerWithToken = {
        type: answer.type,
        sdp: answer.sdp,
        fcmToken: fcmToken,
      };

      socketRef.current?.emit('answer', {
        roomId: roomIdRef.current,
        answer: answerWithToken,
      });
    } catch (err) {
      console.error('Error handling offer:', err);
    }
  };

  const disconnectCall = async (isManual = true) => {
    // Cancel any pending join timeout
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current);
      joinTimeoutRef.current = null;
    }

    if (preferences.hapticEnabled) {
      ReactNativeHapticFeedback.trigger('impactHeavy', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }

    // Save session history
    if (sessionStartRef.current) {
      const duration = (Date.now() - sessionStartRef.current.getTime()) / 1000;
      await saveSession(roomId || 'unknown', 'helper', 'adhoc', sessionStartRef.current, duration);
    }

    if (localAudioStreamRef.current) {
      localAudioStreamRef.current.getTracks().forEach((track: any) => track.stop());
    }
    if (peerConnectionRef.current) peerConnectionRef.current.close();
    socketRef.current?.disconnect();
    InCallManager.stop();
    setRemoteStream(null);
    setIsConnected(false);

    if (isManual) {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.replace('MainTabs');
      }
    }
  };

  const handleTouch = (evt: any) => {
    const { pageX, pageY } = evt.nativeEvent;
    if (socketRef.current && isConnected) {
      socketRef.current.emit('draw-pointer', {
        roomId: roomIdRef.current,
        coordinates: { x: pageX / SCREEN_WIDTH, y: pageY / SCREEN_HEIGHT },
      });
    }
  };

  const handleTouchRelease = () => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('draw-pointer', {
        roomId: roomIdRef.current,
        coordinates: null,
      });
    }
  };

  const handleReadCode = (event: any) => {
    if (hasScanned) return;
    try {
      const parsed = JSON.parse(event.nativeEvent.codeStringValue);
      if (parsed.type === 'screenbuddy-pair') {
        if (preferences.hapticEnabled) {
          ReactNativeHapticFeedback.trigger('notificationSuccess', {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
          });
        }
        setHasScanned(true);
        setIsScanning(false);
        setRoomId(parsed.id);
        roomIdRef.current = parsed.id;
        joinRoom(parsed.id);
        Alert.alert(
          'Device Scanned!',
          `Target Device ID: ${parsed.id}\n\nConnecting instantly...`,
        );
      }
    } catch (err) {
      // Invalid QR code
    }
  };

  // QR Scanner View
  if (isScanning) {
    return (
      <View style={styles.scannerContainer}>
        <Camera
          style={styles.camera}
          scanBarcode={true}
          onReadCode={handleReadCode}
          showFrame={false}
          flashMode="on"
        />
        <View style={styles.overlayContainer} pointerEvents="none">
          <View style={styles.topOverlay} />
          <View style={styles.middleRow}>
            <View style={styles.sideOverlay} />
            <View style={styles.focusedSquare}>
              <Animated.View
                style={[styles.laser, { transform: [{ translateY: laserAnim }] }]}
              />
            </View>
            <View style={styles.sideOverlay} />
          </View>
          <View style={styles.bottomOverlay} />
        </View>
        <View style={styles.scannerOverlayUI}>
          <Text style={styles.scannerText}>Scan the Elder's QR Code</Text>
          <TouchableOpacity
            style={styles.cancelScanButton}
            onPress={() => setIsScanning(false)}
            accessibilityRole="button"
            accessibilityLabel="Cancel scanning"
          >
            <Text style={styles.cancelScanText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Main View
  return (
    <View style={styles.container}>
      <ConnectionBanner status={connectionStatus} />

      {!remoteStream ? (
        <View style={styles.joinContainer}>
          <Text style={styles.title}>Helper Portal</Text>
          <Text style={styles.subtitle}>
            Enter code or scan the device you want to help.
          </Text>

          <Animated.View style={{ width: '80%', transform: [{ translateX: shakeAnim }] }}>
            <TextInput
              style={[styles.input, inputError ? styles.inputError : null]}
              placeholder="ID / Code"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="characters"
              value={roomId}
              onChangeText={(text) => {
                setRoomId(text);
                if (inputError) setInputError('');
              }}
              accessibilityLabel="Device ID input"
              accessibilityHint="Enter the device ID to connect"
            />
            {inputError ? (
              <View style={styles.errorRow}>
                <Icon name="alert-circle" size={14} color={theme.danger} />
                <Text style={styles.errorText}>{inputError}</Text>
              </View>
            ) : null}
          </Animated.View>

          <StyledButton
            title={isConnected ? 'Waiting for Stream...' : 'Join via Code'}
            onPress={() => joinRoom(roomId)}
            disabled={isConnected}
            loading={isConnected}
            variant="primary"
            icon={isConnected ? undefined : 'login'}
            style={{ width: '80%', marginBottom: 10 }}
            accessibilityHint="Connects to the device using the entered code"
          />

          <Text style={styles.orText}>— OR —</Text>

          <StyledButton
            title="Scan QR to Pair"
            onPress={() => {
              setHasScanned(false);
              setIsScanning(true);
            }}
            variant="primary"
            icon="qrcode-scan"
            style={{ width: '80%' }}
            accessibilityHint="Opens the camera to scan a QR code"
          />
        </View>
      ) : (
        <View
          style={styles.streamContainer}
          onStartShouldSetResponder={() => true}
          onResponderGrant={handleTouch}
          onResponderMove={handleTouch}
          onResponderRelease={handleTouchRelease}
        >
          <SessionTimer isActive={!!remoteStream} />
          <QualityBadge stats={connectionStats} visible={preferences.showQualityBadge} />
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.video}
            objectFit="contain"
          />
          {/* Frosted Glass Disconnect Control */}
          <BlurView
            style={styles.overlayControls}
            blurType="dark"
            blurAmount={15}
            reducedTransparencyFallbackColor="rgba(0,0,0,0.8)"
          >
            <TouchableOpacity
              style={styles.disconnectButton}
              onPress={() => disconnectCall(true)}
              accessibilityRole="button"
              accessibilityLabel="Disconnect from session"
            >
              <Icon name="phone-hangup" size={24} color="#FFF" />
              <Text style={styles.disconnectText}>Disconnect</Text>
            </TouchableOpacity>
          </BlurView>

          {/* Chat Overlay */}
          <ChatOverlay
            messages={messages}
            onSend={sendMessage}
            isOpen={isChatOpen}
            onToggle={handleChatToggle}
            unreadCount={unreadCount}
            isChannelOpen={isChannelOpen}
          />
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.surface },
    joinContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    title: { fontSize: 28, fontWeight: 'bold', color: theme.text, marginBottom: 10 },
    subtitle: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 30,
    },
    input: {
      backgroundColor: theme.inputBg,
      color: theme.text,
      width: '100%',
      fontSize: 24,
      textAlign: 'center',
      padding: 15,
      borderRadius: 10,
      marginBottom: 6,
      letterSpacing: 3,
      borderWidth: 1,
      borderColor: theme.border,
    },
    inputError: {
      borderColor: theme.danger,
      borderWidth: 1.5,
    },
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
      paddingHorizontal: 4,
    },
    errorText: {
      color: theme.danger,
      fontSize: 13,
      fontWeight: '600',
      marginLeft: 6,
    },
    orText: {
      color: theme.textSecondary,
      fontSize: 16,
      marginVertical: 30,
      fontWeight: 'bold',
    },
    streamContainer: { flex: 1, backgroundColor: '#000' },
    video: { flex: 1 },
    overlayControls: {
      position: 'absolute',
      bottom: 40,
      alignSelf: 'center',
      borderRadius: 30,
      overflow: 'hidden',
    },
    disconnectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 15,
      paddingHorizontal: 30,
      backgroundColor: 'rgba(244, 67, 54, 0.2)',
    },
    disconnectText: {
      color: '#FFF',
      fontSize: 18,
      fontWeight: 'bold',
      marginLeft: 10,
    },
    scannerContainer: { flex: 1, backgroundColor: '#000' },
    camera: { flex: 1 },
    scannerOverlayUI: {
      position: 'absolute',
      bottom: 60,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    scannerText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 20,
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
      overflow: 'hidden',
    },
    cancelScanButton: {
      backgroundColor: theme.danger,
      paddingHorizontal: 40,
      paddingVertical: 15,
      borderRadius: 30,
    },
    cancelScanText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    overlayContainer: { ...StyleSheet.absoluteFillObject },
    topOverlay: { flex: 1, width: '100%', backgroundColor: 'rgba(0,0,0,0.6)' },
    middleRow: { flexDirection: 'row', height: 280 },
    sideOverlay: { flex: 1, height: 280, backgroundColor: 'rgba(0,0,0,0.6)' },
    focusedSquare: {
      width: 280,
      height: 280,
      borderWidth: 3,
      borderColor: '#FFF',
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: 'transparent',
    },
    bottomOverlay: { flex: 1, width: '100%', backgroundColor: 'rgba(0,0,0,0.6)' },
    laser: {
      width: '100%',
      height: 3,
      backgroundColor: theme.danger,
      shadowColor: theme.danger,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 10,
      elevation: 5,
    },
  });
