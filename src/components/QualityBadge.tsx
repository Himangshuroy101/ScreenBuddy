import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { ConnectionStats, QualityLevel } from '../hooks/useConnectionQuality';

interface Props {
  stats: ConnectionStats;
  visible: boolean;
}

const QUALITY_CONFIG: Record<QualityLevel, { color: string; icon: string; label: string }> = {
  excellent: { color: '#34C759', icon: 'signal-cellular-3', label: 'Excellent' },
  good: { color: '#30D158', icon: 'signal-cellular-2', label: 'Good' },
  fair: { color: '#FF9500', icon: 'signal-cellular-1', label: 'Fair' },
  poor: { color: '#FF3B30', icon: 'signal-cellular-outline', label: 'Poor' },
  unknown: { color: '#8E8E93', icon: 'signal-cellular-outline', label: 'Checking...' },
};

/**
 * Floating connection quality badge with expandable detailed stats.
 */
export default function QualityBadge({ stats, visible }: Props) {
  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue: expanded ? 1 : 0,
      friction: 8,
      useNativeDriver: false, // height animation needs layout
    }).start();
  }, [expanded, expandAnim]);

  if (!visible) return null;

  const config = QUALITY_CONFIG[stats.qualityLevel];

  const detailsHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 120],
  });

  const detailsOpacity = expandAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <View style={styles.container}>
      {/* Mini Badge */}
      <TouchableOpacity
        style={[styles.badge, { backgroundColor: config.color + '20', borderColor: config.color }]}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Connection quality: ${config.label}`}
        accessibilityHint="Tap to view detailed connection statistics"
      >
        <Icon name={config.icon} size={16} color={config.color} />
        <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
      </TouchableOpacity>

      {/* Expanded Stats */}
      <Animated.View
        style={[
          styles.statsPanel,
          {
            height: detailsHeight,
            opacity: detailsOpacity,
            borderColor: config.color + '40',
          },
        ]}
      >
        <View style={styles.statRow}>
          <Icon name="speedometer" size={14} color="#CCC" />
          <Text style={styles.statLabel}>Bitrate</Text>
          <Text style={styles.statValue}>{stats.bitrate} kbps</Text>
        </View>
        <View style={styles.statRow}>
          <Icon name="alert-circle-outline" size={14} color="#CCC" />
          <Text style={styles.statLabel}>Packet Loss</Text>
          <Text style={styles.statValue}>{stats.packetLoss}%</Text>
        </View>
        <View style={styles.statRow}>
          <Icon name="swap-horizontal" size={14} color="#CCC" />
          <Text style={styles.statLabel}>RTT</Text>
          <Text style={styles.statValue}>{stats.roundTripTime} ms</Text>
        </View>
        <View style={styles.statRow}>
          <Icon name="wave" size={14} color="#CCC" />
          <Text style={styles.statLabel}>Jitter</Text>
          <Text style={styles.statValue}>{stats.jitter} ms</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 50,
    alignItems: 'flex-start',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  statsPanel: {
    marginTop: 6,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    overflow: 'hidden',
    width: 180,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  statLabel: {
    color: '#AAA',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
  statValue: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
});
