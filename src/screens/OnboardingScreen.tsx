import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import { useTheme, ThemeColors } from '../theme';
import type { OnboardingScreenProps } from '../types/navigation';

const { width, height } = Dimensions.get('window');

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const slides = [
  {
    id: '1',
    title: 'Welcome to ScreenBuddy',
    description:
      'Bridge the distance. Provide hands-on tech support to your family from anywhere in the world.',
    icon: 'hand-heart',
    color: '#007AFF',
  },
  {
    id: '2',
    title: 'For the Elderly',
    description:
      "Stuck on a confusing screen? Just tap the SOS button to instantly share your screen with a trusted family member.",
    icon: 'lifebuoy',
    color: '#FF3B30',
  },
  {
    id: '3',
    title: 'For the Helper',
    description:
      'See their screen, talk through the loudspeaker, and use a laser pointer to guide them step-by-step.',
    icon: 'cellphone-link',
    color: '#34C759',
  },
  {
    id: '4',
    title: 'One-Time Pairing',
    description:
      'Scan the QR code once to link devices. After that, connecting is as simple as tapping a single button.',
    icon: 'qrcode-scan',
    color: '#AF52DE',
  },
  {
    id: '5',
    title: 'Privacy & Security',
    description:
      'Your screen is shared securely directly to your trusted helper. We never record or store your private data.',
    icon: 'shield-check',
    color: '#FF9500',
  },
];

export default function OnboardingScreen({ navigation }: OnboardingScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<any>(null);
  const theme = useTheme();
  const styles = createStyles(theme);

  // Floating Blob Animations (Native Driven)
  const floatAnim1 = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const floatAnim2 = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const floatAnim3 = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  useEffect(() => {
    const createFloatingAnimation = (
      anim: Animated.ValueXY,
      toX: number,
      toY: number,
      duration: number,
    ) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: { x: toX, y: toY },
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: { x: 0, y: 0 },
            duration,
            useNativeDriver: true,
          }),
        ]),
      );
    };

    createFloatingAnimation(floatAnim1, 40, 60, 4000).start();
    createFloatingAnimation(floatAnim2, -50, -80, 5000).start();
    createFloatingAnimation(floatAnim3, 60, -40, 6000).start();
  }, [floatAnim1, floatAnim2, floatAnim3]);

  // Android back button — do nothing on first slide
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (currentIndex > 0) {
        slidesRef.current?.scrollToIndex({ index: currentIndex - 1 });
        return true;
      }
      return true; // Block exit on first slide
    });
    return () => backHandler.remove();
  }, [currentIndex]);

  // Color Interpolations (JS Driven)
  const blobColor1 = scrollX.interpolate({
    inputRange: [0, width, width * 2, width * 3, width * 4],
    outputRange: ['#007AFF30', '#FF3B3030', '#34C75930', '#AF52DE30', '#FF950030'],
    extrapolate: 'clamp',
  });

  const blobColor2 = scrollX.interpolate({
    inputRange: [0, width, width * 2, width * 3, width * 4],
    outputRange: ['#34C75930', '#007AFF30', '#FF3B3030', '#FF950030', '#AF52DE30'],
    extrapolate: 'clamp',
  });

  const handleScroll = useRef(
    Animated.event(
      [{ nativeEvent: { contentOffset: { x: scrollX } } }],
      { useNativeDriver: false },
    ),
  ).current;

  const completeOnboarding = async () => {
    ReactNativeHapticFeedback.trigger('impactMedium', hapticOptions);
    await AsyncStorage.setItem('HAS_LAUNCHED', 'true');
    navigation.replace('MainTabs');
  };

  const nextSlide = () => {
    if (currentIndex < slides.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      completeOnboarding();
    }
  };

  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    setCurrentIndex(viewableItems[0]?.index || 0);
  }).current;

  const renderItem = ({ item }: { item: (typeof slides)[number] }) => {
    return (
      <View style={styles.slide}>
        <View style={[styles.iconCircle, { backgroundColor: item.color + '15' }]}>
          <Icon name={item.icon} size={100} color={item.color} />
        </View>
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Floating Animated Blobs */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { transform: floatAnim1.getTranslateTransform() },
          ]}
        >
          <Animated.View
            style={[styles.blob, styles.blob1, { backgroundColor: blobColor1 }]}
          />
        </Animated.View>

        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { transform: floatAnim2.getTranslateTransform() },
          ]}
        >
          <Animated.View
            style={[styles.blob, styles.blob2, { backgroundColor: blobColor2 }]}
          />
        </Animated.View>

        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { transform: floatAnim3.getTranslateTransform() },
          ]}
        >
          <Animated.View
            style={[styles.blob, styles.blob3, { backgroundColor: blobColor2 }]}
          />
        </Animated.View>
      </View>

      <View style={styles.header}>
        <TouchableOpacity
          onPress={completeOnboarding}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
          accessibilityHint="Skips the introduction and goes to the home screen"
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 3 }}>
        <Animated.FlatList
          data={slides}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          bounces={false}
          keyExtractor={(item) => item.id}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          onViewableItemsChanged={viewableItemsChanged}
          viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
          ref={slidesRef}
        />
      </View>

      <View style={styles.footer}>
        <View style={styles.paginator}>
          {slides.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];

            const dotScale = scrollX.interpolate({
              inputRange,
              outputRange: [1, 2.4, 1],
              extrapolate: 'clamp',
            });

            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });

            const dotColor = scrollX.interpolate({
              inputRange: [0, width, width * 2, width * 3, width * 4],
              outputRange: ['#007AFF', '#FF3B30', '#34C759', '#AF52DE', '#FF9500'],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                style={[
                  styles.dot,
                  {
                    opacity,
                    backgroundColor: dotColor,
                    transform: [{ scaleX: dotScale }],
                  },
                ]}
                key={i.toString()}
              />
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.8}
          onPress={nextSlide}
          accessibilityRole="button"
          accessibilityLabel={
            currentIndex === slides.length - 1 ? 'Get Started' : 'Next slide'
          }
          accessibilityHint={
            currentIndex === slides.length - 1
              ? 'Completes onboarding and opens the home screen'
              : 'Goes to the next onboarding slide'
          }
        >
          <Text style={styles.buttonText}>
            {currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.surface },

    blob: { position: 'absolute', borderRadius: 200, opacity: 0.6 },
    blob1: { width: 350, height: 350, top: -100, left: -100 },
    blob2: { width: 280, height: 280, bottom: -50, right: -80 },
    blob3: { width: 200, height: 200, top: height * 0.4, left: width * 0.2 },

    header: {
      alignItems: 'flex-end',
      paddingHorizontal: 20,
      paddingTop: 20,
      zIndex: 10,
    },
    skipText: {
      fontSize: 16,
      color: theme.textSecondary,
      fontWeight: 'bold',
    },
    slide: {
      width,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
    },
    iconCircle: {
      width: 200,
      height: 200,
      borderRadius: 100,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 40,
    },
    slideTitle: {
      fontSize: 28,
      fontWeight: '900',
      color: theme.text,
      marginBottom: 15,
      textAlign: 'center',
    },
    description: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      paddingHorizontal: 10,
    },
    footer: {
      flex: 1,
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 40,
      zIndex: 10,
    },
    paginator: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      height: 40,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginHorizontal: 6,
    },
    button: {
      backgroundColor: theme.text === '#FFFFFF' ? theme.accent : '#1C1C1E',
      borderRadius: 20,
      paddingVertical: 18,
      alignItems: 'center',
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 5,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: 'bold',
    },
  });
