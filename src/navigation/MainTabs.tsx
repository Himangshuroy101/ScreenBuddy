import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../theme';
import { usePreferences } from '../context/PreferencesContext';
import HomeScreen from '../screens/HomeScreen';
import SessionHistoryScreen from '../screens/SessionHistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import type { MainTabParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<MainTabParamList>();

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const hapticOptions = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

// ── Tab Config ───────────────────────────────────────────────────────────────
const TAB_BAR_HEIGHT = 64;
const TAB_WIDTH = SCREEN_WIDTH / 3;

// SVG Sliding Canvas constants
// Canvas is 3x screen width so it can slide left/right indefinitely.
const W3 = SCREEN_WIDTH * 3;
const CX = W3 / 2;     // Absolute center of the SVG
const NW = 84;         // Width of the notch bite
const ND = 42;         // Depth of the notch bite
const FAB_SIZE = 54;   // Diameter of the blue sliding circle

const BRAND = '#007AFF';

const TAB_CFG: Record<string, { icon: string; activeIcon: string; label: string }> = {
  SessionHistory: { icon: 'history',      activeIcon: 'history',      label: 'History' },
  Home:           { icon: 'home-outline', activeIcon: 'home',         label: 'Home' },
  Settings:       { icon: 'cog-outline',  activeIcon: 'cog',          label: 'Settings' },
};

// ── Notch Path Generation ────────────────────────────────────────────────────
// Creates a flat top edge with a perfectly smooth, symmetrical apple-style notch
// exactly at the center of the 3x-width SVG.
const notchPath = `
  M 0 0
  L ${CX - NW / 2 - 20} 0
  C ${CX - NW / 2} 0, ${CX - NW / 2 + 8} ${ND}, ${CX} ${ND}
  C ${CX + NW / 2 - 8} ${ND}, ${CX + NW / 2} 0, ${CX + NW / 2 + 20} 0
  L ${W3} 0
  L ${W3} ${TAB_BAR_HEIGHT + 100}
  L 0 ${TAB_BAR_HEIGHT + 100}
  Z
`;

// ── Tab Item ─────────────────────────────────────────────────────────────────
function TabItem({
  route,
  isFocused,
  onPress,
}: {
  route: any;
  isFocused: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const cfg = TAB_CFG[route.name] || { icon: 'circle', activeIcon: 'circle', label: route.name };

  const anim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: isFocused ? 1 : 0,
      friction: 5,
      tension: 65,
      useNativeDriver: true,
    }).start();
  }, [isFocused, anim]);

  // When active, the icon floats UP into the blue FAB space and scales up
  const iconTransY = anim.interpolate({ inputRange: [0, 1], outputRange: [2, -26] });
  const iconScale  = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });

  // Label fades out slightly and moves down when active
  const labelTransY = anim.interpolate({ inputRange: [0, 1], outputRange: [4, 18] });
  const labelOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  // Icon colour crossfade (grey to white)
  // Note: color interpolation works with useNativeDriver on recent RN, 
  // but if it glitches, we can swap node opacity or just use the JS thread.
  // Here we use JS thread for color interpolation safety:
  const AnimatedIcon = Animated.createAnimatedComponent(Icon);
  
  // Create a separate animated value exclusively for color (non-native driven)
  const colorAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(colorAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 250,
      useNativeDriver: false, // Color interp requires JS
    }).start();
  }, [isFocused, colorAnim]);

  const iconColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.textSecondary, '#FFFFFF'],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={cfg.label}
      style={styles.tabItem}
    >
      <Animated.View style={{ transform: [{ translateY: iconTransY }, { scale: iconScale }] }}>
        <AnimatedIcon name={isFocused ? cfg.activeIcon : cfg.icon} size={28} style={{ color: iconColor }} />
      </Animated.View>

      <Animated.Text
        style={[
          styles.tabLabel,
          {
            color: theme.textSecondary,
            opacity: labelOpacity,
            transform: [{ translateY: labelTransY }],
          },
        ]}
      >
        {cfg.label}
      </Animated.Text>
    </TouchableOpacity>
  );
}

// ── Custom Tab Bar ───────────────────────────────────────────────────────────
function AnimatedTabBar({ state, descriptors, navigation }: any) {
  const theme = useTheme();
  const { preferences } = usePreferences();
  const insets = useSafeAreaInsets();
  const activeIndex = state.index;

  // The sliding logic:
  // We want the SVG's absolute center (CX) to align with the active tab's center.
  // Tab centers are at: W/6, W/2, 5W/6.
  // TranslateX = Target Center - CX
  const getTranslateX = (index: number) => {
    const tabCenter = index * TAB_WIDTH + TAB_WIDTH / 2;
    return tabCenter - CX;
  };

  const slideAnim = useRef(new Animated.Value(getTranslateX(activeIndex))).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: getTranslateX(activeIndex),
      friction: 7,
      tension: 60,
      useNativeDriver: true,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const onTabPress = (route: any, isFocused: boolean) => {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) {
      if (preferences.hapticEnabled) ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
      navigation.navigate({ name: route.name, merge: true });
    }
  };

  return (
    <View style={[styles.barWrapper, { height: TAB_BAR_HEIGHT + insets.bottom }]} pointerEvents="box-none">
      
      {/* ── Sliding Canvas containing the SVG Notch and Blue FAB ── */}
      <Animated.View
        style={[
          styles.slidingCanvas,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* The solid tab bar background with the notch cutout */}
        <Svg width={W3} height={TAB_BAR_HEIGHT + 100} style={styles.svg}>
          <Path d={notchPath} fill={theme.card} />
        </Svg>

        {/* The floating blue FAB that perfectly nestles in the notch */}
        <View style={styles.floatingFab} />
      </Animated.View>

      {/* ── Fixed overlay for the touchable Tab Items ── */}
      <View style={styles.tabsRow}>
        {state.routes.map((route: any, index: number) => (
          <TabItem
            key={route.key}
            route={route}
            isFocused={activeIndex === index}
            onPress={() => onTabPress(route, activeIndex === index)}
          />
        ))}
      </View>
    </View>
  );
}

// ── Navigator ────────────────────────────────────────────────────────────────
export default function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="SessionHistory" component={SessionHistoryScreen} />
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  barWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    // Shadow application (Android specific wrapper)
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  slidingCanvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: W3,
    height: '100%',
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  floatingFab: {
    position: 'absolute',
    // Center it horizontally in the 3x canvas
    left: CX - FAB_SIZE / 2,
    // Lift it up so it sticks out of the bar
    top: -22,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: BRAND,
    // Radiant blue dropshadow for the sliding circle
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
  },
  tabsRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  tabItem: {
    width: TAB_WIDTH,
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    position: 'absolute',
    bottom: 8,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
