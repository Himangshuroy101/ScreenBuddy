import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  isActive: boolean;
}

/**
 * Displays an elapsed time counter (MM:SS) during active streaming sessions.
 */
export default function SessionTimer({ isActive }: Props) {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isActive) {
      setSeconds(0);
      intervalRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setSeconds(0);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive]);

  if (!isActive) return null;

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const formatted = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return (
    <View
      style={styles.container}
      accessibilityRole="timer"
      accessibilityLabel={`Session duration: ${minutes} minutes and ${secs} seconds`}
    >
      <View style={styles.dot} />
      <Text style={styles.text}>{formatted}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    zIndex: 50,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    marginRight: 8,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
});
