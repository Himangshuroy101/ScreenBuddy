import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useTheme, ThemeColors } from '../theme';
import { getSessions, clearSessions, SessionRecord } from '../services/sessionHistory';
import type { SessionHistoryScreenProps } from '../types/navigation';

export default function SessionHistoryScreen({ navigation }: SessionHistoryScreenProps) {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const theme = useTheme();
  const styles = createStyles(theme);

  useFocusEffect(
    useCallback(() => {
      getSessions().then(setSessions);
    }, []),
  );

  const handleClear = () => {
    Alert.alert('Clear History', 'Delete all session records?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          await clearSessions();
          setSessions([]);
        },
      },
    ]);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (iso: string): string => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDays === 1) return `Yesterday, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderItem = ({ item }: { item: SessionRecord }) => (
    <View style={styles.card}>
      <View style={styles.cardIcon}>
        <Icon
          name={item.role === 'broadcaster' ? 'monitor-share' : 'shield-account'}
          size={24}
          color={item.role === 'broadcaster' ? theme.danger : theme.accent}
        />
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardTop}>
          <Text style={styles.peerText}>
            {item.role === 'broadcaster' ? 'Shared Screen' : 'Helped Device'}
          </Text>
          <View style={[styles.modeBadge, item.mode === 'sos' && styles.sosBadge]}>
            <Text style={[styles.modeText, item.mode === 'sos' && styles.sosText]}>
              {item.mode === 'sos' ? 'SOS' : 'Ad-hoc'}
            </Text>
          </View>
        </View>
        <Text style={styles.peerIdText}>Peer: {item.peerDeviceId}</Text>
        <View style={styles.cardBottom}>
          <View style={styles.infoChip}>
            <Icon name="clock-outline" size={14} color={theme.textSecondary} />
            <Text style={styles.infoText}>{formatDuration(item.duration)}</Text>
          </View>
          <Text style={styles.dateText}>{formatDate(item.startedAt)}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="history" size={22} color={theme.accent} style={{ marginRight: 10 }} />
          <Text style={styles.headerTitle}>Session History</Text>
        </View>
        {sessions.length > 0 && (
          <TouchableOpacity
            onPress={handleClear}
            style={styles.clearButton}
            accessibilityRole="button"
            accessibilityLabel="Clear all history"
          >
            <Icon name="delete-outline" size={22} color={theme.danger} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={sessions}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="history" size={80} color={theme.border} />
            <Text style={styles.emptyTitle}>No Sessions Yet</Text>
            <Text style={styles.emptySubtitle}>
              Your completed support sessions will appear here.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 18,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.text,
    },
    clearButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.badgeBg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContent: {
      padding: 20,
      paddingTop: 8,
      paddingBottom: 100,
      flexGrow: 1,
    },
    card: {
      flexDirection: 'row',
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 3,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.badgeBg,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    cardContent: { flex: 1 },
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    peerText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text,
    },
    modeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor: theme.badgeBg,
    },
    sosBadge: {
      backgroundColor: '#FF3B3020',
    },
    modeText: {
      fontSize: 11,
      fontWeight: 'bold',
      color: theme.textSecondary,
    },
    sosText: {
      color: '#FF3B30',
    },
    peerIdText: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 4,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    cardBottom: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    infoChip: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    infoText: {
      fontSize: 13,
      color: theme.textSecondary,
      marginLeft: 4,
      fontWeight: '600',
    },
    dateText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 80,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.text,
      marginTop: 16,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
  });
