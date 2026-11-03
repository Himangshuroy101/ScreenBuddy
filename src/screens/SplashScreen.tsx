import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, ThemeColors } from '../theme';
import type { SplashScreenProps } from '../types/navigation';

const { width, height } = Dimensions.get('window');

const ACCENT = '#007AFF';
const DANGER = '#FF3B30';

export default function SplashScreen({ navigation }: SplashScreenProps) {
  const theme = useTheme();
  const styles = createStyles(theme);

  // ── Animation values ────────────────────────────────────────────────────
  const logoScale    = useRef(new Animated.Value(0)).current;
  const logoBounce   = useRef(new Animated.Value(0)).current;
  const logoOpacity  = useRef(new Animated.Value(0)).current;
  const ringScale    = useRef(new Animated.Value(0.4)).current;
  const ringOpacity  = useRef(new Animated.Value(0)).current;
  const ring2Scale   = useRef(new Animated.Value(0.4)).current;
  const ring2Opacity = useRef(new Animated.Value(0)).current;
  const textOpacity  = useRef(new Animated.Value(0)).current;
  const textTransY   = useRef(new Animated.Value(18)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTransY  = useRef(new Animated.Value(12)).current;
  const dot1Opacity  = useRef(new Animated.Value(0)).current;
  const dot2Opacity  = useRef(new Animated.Value(0)).current;
  const dot3Opacity  = useRef(new Animated.Value(0)).current;

  // ── Floating ambient blob animations ────────────────────────────────────
  const blob1Trans = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const blob2Trans = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  useEffect(() => {
    // Floating blobs
    const floatBlob = (anim: Animated.ValueXY, x: number, y: number, dur: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: { x, y }, duration: dur, useNativeDriver: true }),
          Animated.timing(anim, { toValue: { x: 0, y: 0 }, duration: dur, useNativeDriver: true }),
        ]),
      ).start();

    floatBlob(blob1Trans, 30, 50, 3800);
    floatBlob(blob2Trans, -40, -55, 4600);

    // ── Cinematic sequenced entrance ────────────────────────────────────
    Animated.sequence([
      // 1 — Logo icon pops in with spring
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 5,
          tension: 120,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
      ]),

      // 2 — Ripple rings expand outward
      Animated.parallel([
        Animated.timing(ringScale, {
          toValue: 1.8,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Slight bounce after pop
    setTimeout(() => {
      Animated.sequence([
        Animated.timing(logoBounce, { toValue: -10, duration: 160, useNativeDriver: true }),
        Animated.spring(logoBounce, { toValue: 0, friction: 4, useNativeDriver: true }),
      ]).start();
    }, 350);

    // Second ring delayed
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(ring2Scale, { toValue: 2.4, duration: 900, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
        Animated.timing(ring2Opacity, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]).start();
      Animated.timing(ring2Opacity, { toValue: 0.3, duration: 50, useNativeDriver: true }).start();
    }, 200);

    // Brand name slides up
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
        Animated.timing(textTransY,  { toValue: 0, duration: 400, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
      ]).start();
    }, 500);

    // Subtitle after brand
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(subtitleOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(subtitleTransY,  { toValue: 0, duration: 400, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
      ]).start();
    }, 720);

    // Loading dots cascade
    const dotDelay = [900, 1050, 1200];
    [dot1Opacity, dot2Opacity, dot3Opacity].forEach((dot, i) => {
      setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(dot, { toValue: 0.2, duration: 300, useNativeDriver: true }),
          ]),
        ).start();
      }, dotDelay[i]);
    });

    // ── Routing ─────────────────────────────────────────────────────────
    const checkFirstLaunch = async () => {
      try {
        const hasLaunched = await AsyncStorage.getItem('HAS_LAUNCHED');
        // minimum splash time of 2.4 s for the animation to breathe
        setTimeout(() => {
          if (hasLaunched === 'true') {
            navigation.replace('MainTabs');
          } else {
            navigation.replace('Onboarding');
          }
        }, 2400);
      } catch {
        setTimeout(() => navigation.replace('MainTabs'), 2400);
      }
    };

    checkFirstLaunch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      {/* ── Background gradient blobs ── */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Animated.View
          style={[
            styles.blob,
            styles.blob1,
            { transform: blob1Trans.getTranslateTransform() },
          ]}
        />
        <Animated.View
          style={[
            styles.blob,
            styles.blob2,
            { transform: blob2Trans.getTranslateTransform() },
          ]}
        />
      </View>

      {/* ── Logo area ── */}
      <Animated.View
        style={{
          opacity: logoOpacity,
          transform: [{ scale: logoScale }, { translateY: logoBounce }],
          alignItems: 'center',
        }}
      >
        {/* ripple ring 1 */}
        <Animated.View
          style={[
            styles.ring,
            { transform: [{ scale: ringScale }], opacity: ringOpacity },
          ]}
          pointerEvents="none"
        />
        {/* ripple ring 2 */}
        <Animated.View
          style={[
            styles.ring,
            styles.ring2,
            { transform: [{ scale: ring2Scale }], opacity: ring2Opacity },
          ]}
          pointerEvents="none"
        />

        {/* App Logo */}
        <View style={styles.iconContainer}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="cover"
          />
        </View>
      </Animated.View>

      {/* ── Brand name ── */}
      <Animated.Text
        style={[
          styles.brandTitle,
          { opacity: textOpacity, transform: [{ translateY: textTransY }] },
        ]}
      >
        Screen<Text style={styles.brandAccent}>Buddy</Text>
      </Animated.Text>

      {/* ── Tagline ── */}
      <Animated.Text
        style={[
          styles.subtitle,
          { opacity: subtitleOpacity, transform: [{ translateY: subtitleTransY }] },
        ]}
      >
        Family tech support, simplified.
      </Animated.Text>

      {/* ── Loading dots ── */}
      <View style={styles.dotsRow}>
        {[dot1Opacity, dot2Opacity, dot3Opacity].map((anim, i) => (
          <Animated.View
            key={i}
            style={[styles.dot, { opacity: anim }]}
          />
        ))}
      </View>
    </View>
  );
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // ── Ambient blobs
    blob: {
      position: 'absolute',
      borderRadius: 300,
      opacity: 0.28,
    },
    blob1: {
      width: 380,
      height: 380,
      top: -80,
      left: -100,
      backgroundColor: ACCENT,
    },
    blob2: {
      width: 320,
      height: 320,
      bottom: -60,
      right: -80,
      backgroundColor: DANGER,
    },

    // ── Logo
    iconContainer: {
      width: 130,
      height: 130,
      borderRadius: 32,
      backgroundColor: '#FFFFFF',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: ACCENT,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.45,
      shadowRadius: 24,
      elevation: 16,
      overflow: 'hidden',
    },
    logoImage: {
      width: '100%',
      height: '100%',
    },
    ring: {
      position: 'absolute',
      width: 130,
      height: 130,
      borderRadius: 32,
      borderWidth: 2,
      borderColor: ACCENT,
    },
    ring2: {
      borderColor: ACCENT + '80',
    },

    // ── Text
    brandTitle: {
      fontSize: 46,
      fontWeight: '900',
      color: theme.text,
      letterSpacing: -1.5,
      marginTop: 28,
    },
    brandAccent: {
      color: ACCENT,
    },
    subtitle: {
      fontSize: 16,
      color: theme.textSecondary,
      marginTop: 10,
      fontWeight: '500',
      letterSpacing: 0.2,
    },

    // ── Loading dots
    dotsRow: {
      flexDirection: 'row',
      marginTop: 48,
      gap: 8,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: ACCENT,
    },
  });
