import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected' | 'error';

interface Props {
  status: ConnectionStatus;
}

const STATUS_CONFIG: Record<ConnectionStatus, { color: string; icon: string; label: string }> = {
  connected: { color: '#34C759', icon: 'wifi', label: 'Connected' },
  reconnecting: { color: '#FF9500', icon: 'wifi-strength-1-alert', label: 'Reconnecting…' },
  disconnected: { color: '#FF3B30', icon: 'wifi-off', label: 'Disconnected' },
  error: { color: '#FF3B30', icon: 'alert-circle', label: 'Connection Error' },
};

/**
 * A sliding banner that shows the current socket connection status.
 * Auto-hides when connected, slides down for any issues.
 */
export default function ConnectionBanner({ status }: Props) {
  const slideAnim = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    if (status === 'connected') {
      // Briefly show "Connected", then slide away
      Animated.sequence([
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(1500),
        Animated.timing(slideAnim, { toValue: -60, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      // Slide down and stay
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }
  }, [status, slideAnim]);

  const config = STATUS_CONFIG[status];

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: config.color, transform: [{ translateY: slideAnim }] },
      ]}
      accessibilityRole="alert"
      accessibilityLabel={`Connection status: ${config.label}`}
    >
      <Icon name={config.icon} size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
      <Text style={styles.text}>{config.label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    zIndex: 100,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
