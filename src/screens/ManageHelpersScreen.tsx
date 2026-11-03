import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useTheme, ThemeColors } from '../theme';
import { getHelpers, removeHelper, PairedHelper } from '../services/pairing';
import type { ManageHelpersScreenProps } from '../types/navigation';

const MAX_HELPERS = 3;

export default function ManageHelpersScreen({ navigation }: ManageHelpersScreenProps) {
  const [helpers, setHelpers] = useState<PairedHelper[]>([]);
  const theme = useTheme();
  const styles = createStyles(theme);

  useFocusEffect(
    useCallback(() => {
      getHelpers().then(setHelpers);
    }, []),
  );

  const handleRemove = (helper: PairedHelper) => {
    Alert.alert(
      'Remove Helper?',
      `Remove ${helper.label || helper.deviceId}? They won't receive SOS notifications anymore.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeHelper(helper.fcmToken);
            const updated = await getHelpers();
            setHelpers(updated);
          },
        },
      ],
    );
  };

  const formatDate = (iso: string): string => {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderItem = ({ item, index }: { item: PairedHelper; index: number }) => (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={[styles.avatar, { backgroundColor: COLORS[index % COLORS.length] + '20' }]}>
          <Icon name="account" size={28} color={COLORS[index % COLORS.length]} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.helperName}>{item.label || `Helper ${index + 1}`}</Text>
          <Text style={styles.helperId}>ID: {item.deviceId}</Text>
          <Text style={styles.helperDate}>Paired {formatDate(item.pairedAt)}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => handleRemove(item)}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${item.label || item.deviceId}`}
      >
        <Icon name="close-circle" size={24} color={theme.danger} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-left" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paired Helpers</Text>
        <Text style={styles.countBadge}>
          {helpers.length}/{MAX_HELPERS}
        </Text>
      </View>

      <FlatList
        data={helpers}
        renderItem={renderItem}
        keyExtractor={(item) => item.fcmToken}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.infoCard}>
            <Icon name="information-outline" size={20} color={theme.accent} />
            <Text style={styles.infoText}>
              Paired helpers receive push notifications when you press the SOS button.
              You can pair up to {MAX_HELPERS} helpers.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="account-group-outline" size={80} color={theme.border} />
            <Text style={styles.emptyTitle}>No Helpers Paired</Text>
            <Text style={styles.emptySubtitle}>
              Share your screen via QR code or ID to automatically pair a helper.
            </Text>
          </View>
        }
        ListFooterComponent={
          helpers.length >= MAX_HELPERS ? (
            <View style={styles.maxReached}>
              <Icon name="alert-circle-outline" size={16} color={theme.warning} />
              <Text style={styles.maxText}>Maximum of {MAX_HELPERS} helpers reached</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const COLORS = ['#007AFF', '#34C759', '#AF52DE'];

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.badgeBg,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    headerTitle: {
      flex: 1,
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.text,
    },
    countBadge: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.textSecondary,
      backgroundColor: theme.badgeBg,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    listContent: {
      padding: 20,
      paddingTop: 8,
      flexGrow: 1,
    },
    infoCard: {
      flexDirection: 'row',
      backgroundColor: theme.accent + '10',
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
      alignItems: 'flex-start',
    },
    infoText: {
      fontSize: 13,
      color: theme.textSecondary,
      marginLeft: 10,
      flex: 1,
      lineHeight: 19,
    },
    card: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    avatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    cardInfo: { flex: 1 },
    helperName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text,
    },
    helperId: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    helperDate: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 2,
    },
    removeButton: {
      padding: 8,
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
      paddingHorizontal: 20,
    },
    maxReached: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
    },
    maxText: {
      color: theme.warning,
      fontSize: 13,
      fontWeight: '600',
      marginLeft: 6,
    },
  });
