import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Alert,
  Modal,
  Linking,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { getMessaging } from '@react-native-firebase/messaging';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import { useTheme, ThemeColors } from '../theme';
import { usePreferences } from '../context/PreferencesContext';
import { getHelperCount } from '../services/pairing';
import { getSessions, SessionRecord } from '../services/sessionHistory';
import type { HomeScreenProps } from '../types/navigation';

const { width } = Dimensions.get('window');

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// ── Quick Tips ────────────────────────────────────────────────────────────────
const TIPS = [
  { icon: 'qrcode-scan',     text: 'Ask your helper to scan your QR code to pair instantly.' },
  { icon: 'shield-lock',     text: 'Your screen is only shared with whoever connects using your room code.' },
  { icon: 'bell-ring',       text: 'Enable notifications so paired helpers can reach you with one tap.' },
  { icon: 'wifi-strength-4', text: 'A strong Wi-Fi connection gives the best screen sharing quality.' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(isoString: string): string {
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }: HomeScreenProps) {
  const [isPaired, setIsPaired]             = useState(false);
  const [helperCount, setHelperCount]       = useState(0);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [lastSession, setLastSession]       = useState<SessionRecord | null>(null);
  const [tipIndex, setTipIndex]             = useState(0);
  const [isLoading, setIsLoading]           = useState(true);

  const scaleValue   = useRef(new Animated.Value(1)).current;
  const ringScale    = useRef(new Animated.Value(1)).current;
  const ringOpacity  = useRef(new Animated.Value(0.4)).current;

  const theme = useTheme();
  const styles = createStyles(theme);
  const { preferences } = usePreferences();

  useFocusEffect(
    useCallback(() => {
      const initializeDevice = async () => {
        try {
          let storedId = await AsyncStorage.getItem('DEVICE_ID');
          if (!storedId) {
            const { generateDeviceId } = require('../config');
            storedId = generateDeviceId();
            await AsyncStorage.setItem('DEVICE_ID', storedId!);
          }
          const count = await getHelperCount();
          setHelperCount(count);
          setIsPaired(count > 0);

          const sessions = await getSessions();
          setLastSession(sessions[0] ?? null);
        } catch (e) {
          console.error('Error loading device data', e);
        } finally {
          setIsLoading(false);
        }
      };
      initializeDevice();

      // Rotate tip every 6 seconds
      const tipTimer = setInterval(() => {
        setTipIndex((i) => (i + 1) % TIPS.length);
      }, 6000);
      return () => clearInterval(tipTimer);
    }, []),
  );

  useEffect(() => {
    const messagingInstance = getMessaging();

    const unsubscribeBackground = messagingInstance.onNotificationOpenedApp(
      (remoteMessage) => {
        if (remoteMessage.data?.roomId) {
          navigation.navigate('Helper', {
            autoJoinRoomId: remoteMessage.data.roomId as string,
          });
        }
      },
    );

    messagingInstance.getInitialNotification().then((remoteMessage) => {
      if (remoteMessage?.data?.roomId) {
        setTimeout(() => {
          navigation.navigate('Helper', {
            autoJoinRoomId: remoteMessage.data!.roomId as string,
          });
        }, 500);
      }
    });

    const unsubscribeForeground = messagingInstance.onMessage(async (remoteMessage) => {
      Alert.alert(
        remoteMessage.notification?.title || '🆘 Urgent: Help Needed!',
        remoteMessage.notification?.body ||
          'Your family member needs screen support. Tap to connect instantly.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Connect Now',
            onPress: () => {
              if (remoteMessage.data?.roomId) {
                navigation.navigate('Helper', {
                  autoJoinRoomId: remoteMessage.data.roomId as string,
                });
              }
            },
          },
        ],
      );
    });

    // SOS card: subtle heartbeat scale + radar ring
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scaleValue, { toValue: 1.05, duration: 800, useNativeDriver: true }),
          Animated.timing(scaleValue, { toValue: 1,    duration: 800, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.parallel([
            Animated.timing(ringScale,   { toValue: 2.2, duration: 2500, useNativeDriver: true }),
            Animated.timing(ringOpacity, { toValue: 0,   duration: 2500, useNativeDriver: true }),
          ]),
          Animated.timing(ringScale,   { toValue: 1,   duration: 0, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.4, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    ).start();

    return () => {
      unsubscribeBackground();
      unsubscribeForeground();
    };
  }, [navigation, scaleValue, ringScale, ringOpacity]);

  const handleSosPress = () => {
    if (preferences.hapticEnabled) {
      ReactNativeHapticFeedback.trigger('impactHeavy', hapticOptions);
    }
    if (isPaired) {
      navigation.navigate('Broadcaster', { mode: 'sos' });
    } else {
      navigation.navigate('Broadcaster', { mode: 'adhoc' });
    }
  };

  const handleReportBug = () => {
    if (preferences.hapticEnabled) {
      ReactNativeHapticFeedback.trigger('impactMedium', hapticOptions);
    }
    const email = 'geeksbuddy05@gmail.com';
    const subject = 'ScreenBuddy App Feedback / Bug Report';
    const body =
      'Hi Himangshu,\n\nI am using ScreenBuddy and wanted to report the following issue/feedback:\n\n[Please describe the issue here]\n\nDevice info: (Optional)';
    Linking.openURL(
      `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    );
  };

  const tip = TIPS[tipIndex];

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brandTitle}>
            Screen<Text style={styles.brandAccent}>Buddy</Text>
          </Text>
          <Text style={styles.subtitle}>Tap a button below to begin.</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowAboutModal(true)}
            accessibilityRole="button"
            accessibilityLabel="About ScreenBuddy"
          >
            <Icon name="information-variant" size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Scrollable content ── */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── SOS Card — Primary Action ── */}
        <Animated.View style={{ transform: [{ scale: scaleValue }], width: '100%' }}>
          {isLoading ? (
            <View style={[styles.premiumCard, styles.sosCard, styles.skeletonCard]} />
          ) : (
            <TouchableOpacity
              style={[styles.premiumCard, styles.sosCard]}
              activeOpacity={0.8}
              onPress={handleSosPress}
              accessibilityRole="button"
              accessibilityLabel={isPaired ? 'Get Help Now' : 'I Need Help'}
              accessibilityHint={
                isPaired
                  ? 'Calls your helper and shares your screen instantly'
                  : 'Starts sharing your screen so a helper can connect'
              }
            >
              {/* Radar pulse ring */}
              <Animated.View
                style={[
                  styles.iconCircleRed,
                  {
                    position: 'absolute',
                    top: 40,
                    transform: [{ scale: ringScale }],
                    opacity: ringOpacity,
                  },
                ]}
                pointerEvents="none"
              />
              <View style={styles.iconCircleRed}>
                <Icon name="lifebuoy" size={48} color={theme.danger} />
              </View>
              <Text style={styles.sosTitle}>
                {isPaired ? '🆘 Get Help Now' : 'I Need Help'}
              </Text>
              <Text style={styles.sosDescription}>
                {isPaired
                  ? 'Tap here to call your helper instantly.'
                  : 'Share your screen so someone can help you.'}
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* ── Helper Card ── */}
        {isLoading ? (
          <View style={[styles.premiumCard, styles.helperCard, styles.skeletonCard, { height: 80 }]} />
        ) : (
          <TouchableOpacity
            style={[styles.premiumCard, styles.helperCard]}
            activeOpacity={0.9}
            onPress={() => {
              if (preferences.hapticEnabled) {
                ReactNativeHapticFeedback.trigger('impactMedium', hapticOptions);
              }
              navigation.navigate('Helper');
            }}
            accessibilityRole="button"
            accessibilityLabel="Family Helper"
            accessibilityHint="Opens the helper screen to connect to a family member's screen"
          >
            <View style={styles.cardHeader}>
              <View style={styles.iconCircleBlue}>
                <Icon name="shield-account" size={32} color="#FFFFFF" />
              </View>
              <View style={styles.helperTextContainer}>
                <Text style={styles.helperTitle}>Family Helper</Text>
                <Text style={styles.helperDescription}>
                  Enter code or scan QR to connect.
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {isLoading ? null : (
          <View style={styles.pairingBadge}>
            <Icon
              name={isPaired ? 'check-decagram' : 'alert-circle-outline'}
              size={16}
              color={theme.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.pairingText}>
              {isPaired
                ? `${helperCount} Helper${helperCount > 1 ? 's' : ''} Paired`
                : 'No device paired yet'}
            </Text>
          </View>
        )}

        {/* ── Last Session Widget (only shown when there is history) ── */}
        {lastSession && (
          <TouchableOpacity
            style={styles.widgetCard}
            onPress={() => navigation.navigate('SessionHistory')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="View last session"
          >
            <View style={styles.widgetRow}>
              <View style={[styles.widgetIconBox, { backgroundColor: theme.success + '22' }]}>
                <Icon name="history" size={20} color={theme.success} />
              </View>
              <View style={styles.widgetTextBlock}>
                <Text style={styles.widgetTitle}>Last Session</Text>
                <Text style={styles.widgetSub}>
                  {lastSession.role === 'broadcaster' ? 'You shared your screen' : 'You helped someone'}
                  {' · '}{formatDuration(lastSession.duration)}
                </Text>
              </View>
              <Text style={styles.widgetTime}>{timeAgo(lastSession.startedAt)}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Quick Tip Widget ── */}
        <View style={styles.widgetCard}>
          <View style={styles.widgetRow}>
            <View style={[styles.widgetIconBox, { backgroundColor: theme.accent + '18' }]}>
              <Icon name={tip.icon} size={20} color={theme.accent} />
            </View>
            <View style={styles.widgetTextBlock}>
              <Text style={styles.widgetTitle}>Quick Tip</Text>
              <Text style={styles.widgetSub}>{tip.text}</Text>
            </View>
          </View>
          {/* Auto-rotating dot indicators */}
          <View style={styles.tipDots}>
            {TIPS.map((_, i) => (
              <View key={i} style={[styles.tipDot, i === tipIndex && styles.tipDotActive]} />
            ))}
          </View>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── About Modal ── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAboutModal}
        onRequestClose={() => setShowAboutModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPressOut={() => setShowAboutModal(false)}
        >
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.topRightClose}
                onPress={() => setShowAboutModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Close about dialog"
              >
                <Icon name="close-circle" size={28} color={theme.divider} />
              </TouchableOpacity>

              <View style={styles.modalDragIndicator} />

              <Text style={styles.modalTitle}>About ScreenBuddy</Text>
              <Text style={styles.versionText}>Version 1.0.0 (Beta)</Text>

              {/* Developer Profile Card */}
              <View style={styles.developerCard}>
                <View style={styles.developerCardHeader}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>HR</Text>
                  </View>
                  <View style={styles.developerInfo}>
                    <Text style={styles.builtByText}>Designed & Built by</Text>
                    <Text style={styles.devName}>Himangshu Roy</Text>
                    <Text style={styles.devRole}>React Native Developer</Text>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.socialRow}>
                  {[
                    { icon: 'linkedin',  color: '#0077B5', url: 'https://www.linkedin.com/in/himangshuroy101' },
                    { icon: 'github',    color: theme.text, url: 'https://github.com/Himangshuroy101' },
                    { icon: 'instagram', color: '#E1306C', url: 'https://www.instagram.com/himangshu_78?igsh=eWN6aXRjbjd2b2o5' },
                  ].map(({ icon, color, url }) => (
                    <TouchableOpacity key={icon} style={styles.socialButton} onPress={() => Linking.openURL(url)} accessibilityRole="link">
                      <Icon name={icon} size={22} color={color} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Support Section */}
              <View style={styles.supportSection}>
                <Text style={styles.supportHeader}>Experience an issue?</Text>
                <Text style={styles.supportSubText}>
                  I am constantly working to make ScreenBuddy better for families.
                  Let me know if you find a bug!
                </Text>
                <TouchableOpacity
                  style={styles.bugButton}
                  onPress={handleReportBug}
                  accessibilityRole="button"
                  accessibilityLabel="Report a bug"
                  accessibilityHint="Opens your email app to send a bug report"
                >
                  <Icon name="bug-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.bugButtonText}>Report a Bug</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: 30,
      paddingTop: 20,
      paddingBottom: 10,
    },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerButton: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: theme.badgeBg,
      justifyContent: 'center', alignItems: 'center',
    },
    brandTitle: { fontSize: 36, fontWeight: '900', color: theme.text, letterSpacing: -1 },
    brandAccent: { color: theme.accent },
    subtitle: { fontSize: 16, color: theme.textSecondary, marginTop: 5, fontWeight: '500' },

    // Scrollable content area
    content: {
      paddingHorizontal: 24,
      paddingTop: 10,
      alignItems: 'center',
    },

    // Cards — identical to original
    premiumCard: {
      width: '100%',
      borderRadius: 24,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 8,
    },
    skeletonCard: {
      backgroundColor: theme.divider,
      borderColor: theme.divider,
      minHeight: 220,
    },
    sosCard: {
      backgroundColor: theme.sosCardBg,
      borderWidth: 2,
      borderColor: theme.sosCardBorder,
      alignItems: 'center',
      paddingVertical: 40,
    },
    iconCircleRed: {
      width: 100, height: 100, borderRadius: 50,
      backgroundColor: theme.sosIconBg,
      justifyContent: 'center', alignItems: 'center',
      marginBottom: 20,
    },
    sosTitle: { fontSize: 32, fontWeight: 'bold', color: theme.danger, marginBottom: 8 },
    sosDescription: { fontSize: 16, color: theme.textSecondary, fontWeight: '500' },

    dividerContainer: {
      flexDirection: 'row', alignItems: 'center',
      width: '100%', marginVertical: 28,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: theme.divider },
    dividerText: { paddingHorizontal: 15, color: theme.divider, fontWeight: 'bold', fontSize: 14 },

    helperCard: { backgroundColor: theme.helperCardBg },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    iconCircleBlue: {
      width: 60, height: 60, borderRadius: 30,
      backgroundColor: theme.helperIconBg,
      justifyContent: 'center', alignItems: 'center',
      marginRight: 16,
    },
    helperTextContainer: { flex: 1 },
    helperTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
    helperDescription: { fontSize: 14, color: theme.textSecondary, marginTop: 4 },

    pairingBadge: {
      marginTop: 24,
      backgroundColor: theme.badgeBg,
      paddingVertical: 8, paddingHorizontal: 16,
      borderRadius: 20, flexDirection: 'row', alignItems: 'center',
    },
    pairingText: { fontSize: 13, color: theme.textSecondary, fontWeight: 'bold' },

    // ── NEW: Widget Cards ─────────────────────────────────────────────────────
    widgetCard: {
      width: '100%',
      borderRadius: 16,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      marginTop: 16,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    widgetRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    widgetIconBox: {
      width: 42, height: 42, borderRadius: 12,
      justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    },
    widgetTextBlock: { flex: 1 },
    widgetTitle: { fontSize: 13, fontWeight: '700', color: theme.text },
    widgetSub: { fontSize: 12, color: theme.textSecondary, marginTop: 2, lineHeight: 17 },
    widgetTime: { fontSize: 11, color: theme.textSecondary, fontWeight: '600', flexShrink: 0 },

    // Tip auto-rotating dots
    tipDots: { flexDirection: 'row', justifyContent: 'center', marginTop: 12, gap: 6 },
    tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.border },
    tipDotActive: { backgroundColor: theme.accent, width: 16, borderRadius: 3 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: theme.modalOverlay, justifyContent: 'flex-end' },
    modalContent: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 30, borderTopRightRadius: 30,
      padding: 30, paddingBottom: 40, alignItems: 'center',
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20,
    },
    topRightClose: { position: 'absolute', top: 20, right: 20, zIndex: 10, padding: 5 },
    modalDragIndicator: { width: 40, height: 5, backgroundColor: theme.divider, borderRadius: 3, marginBottom: 20 },
    modalTitle: { fontSize: 24, fontWeight: 'bold', color: theme.text },
    versionText: { fontSize: 14, color: theme.textSecondary, marginBottom: 30, marginTop: 4 },
    developerCard: {
      backgroundColor: theme.card, borderRadius: 20, width: '100%',
      marginBottom: 30, overflow: 'hidden', borderWidth: 1, borderColor: theme.border,
    },
    developerCardHeader: { flexDirection: 'row', padding: 20, alignItems: 'center' },
    avatarCircle: {
      width: 60, height: 60, borderRadius: 30,
      backgroundColor: theme.accent,
      justifyContent: 'center', alignItems: 'center', marginRight: 15,
    },
    avatarText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', letterSpacing: 1 },
    developerInfo: { flex: 1 },
    builtByText: { fontSize: 12, color: theme.textSecondary, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.5 },
    devName: { fontSize: 20, fontWeight: 'bold', color: theme.text, marginTop: 2 },
    devRole: { fontSize: 14, color: theme.accent, fontWeight: '600', marginTop: 2 },
    cardDivider: { height: 1, backgroundColor: theme.border, marginHorizontal: 20 },
    socialRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 10 },
    socialButton: {
      width: 44, height: 44, borderRadius: 22, backgroundColor: theme.surface,
      justifyContent: 'center', alignItems: 'center',
      shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    supportSection: { width: '100%', marginBottom: 10 },
    supportHeader: { fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 8 },
    supportSubText: { fontSize: 14, color: theme.textSecondary, lineHeight: 20, marginBottom: 20 },
    bugButton: {
      flexDirection: 'row', backgroundColor: theme.danger,
      paddingVertical: 16, borderRadius: 16,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: theme.danger, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
    },
    bugButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  });
