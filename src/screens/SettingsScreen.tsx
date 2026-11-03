import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { Linking } from 'react-native';

import { useTheme, ThemeColors } from '../theme';
import { usePreferences } from '../context/PreferencesContext';
import { SIGNALING_SERVER, PRIVACY_POLICY_URL } from '../config';
import type { SettingsScreenProps } from '../types/navigation';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { preferences, updatePreference } = usePreferences();

  const [deviceId, setDeviceId] = React.useState('...');

  React.useEffect(() => {
    AsyncStorage.getItem('DEVICE_ID').then((id) => {
      if (id) setDeviceId(id);
    });
  }, []);

  const copyDeviceId = () => {
    Clipboard.setString(deviceId);
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    Alert.alert('Copied', 'Device ID copied to clipboard.');
  };

  const handleResetDeviceId = () => {
    Alert.alert(
      'Reset Device ID?',
      'This will generate a new ID. All paired helpers will need to re-scan your QR code.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const { generateDeviceId } = require('../config');
            const newId = generateDeviceId();
            await AsyncStorage.setItem('DEVICE_ID', newId);
            setDeviceId(newId);
          },
        },
      ],
    );
  };

  const handleReportBug = () => {
    const email = 'geeksbuddy05@gmail.com';
    const subject = 'ScreenBuddy App Feedback / Bug Report';
    const body = 'Hi Himangshu,\n\nI am using ScreenBuddy and wanted to report:\n\n';
    Linking.openURL(
      `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    );
  };

  const darkModeLabel =
    preferences.darkModeOverride === 'system'
      ? 'System'
      : preferences.darkModeOverride === 'dark'
        ? 'Dark'
        : 'Light';

  const cycleDarkMode = () => {
    const modes: Array<'system' | 'light' | 'dark'> = ['system', 'light', 'dark'];
    const currentIndex = modes.indexOf(preferences.darkModeOverride);
    const next = modes[(currentIndex + 1) % modes.length];
    updatePreference('darkModeOverride', next);
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
  };

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
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Account Section */}
        <Text style={styles.sectionTitle}>ACCOUNT</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.row} onPress={copyDeviceId}>
            <View style={styles.rowLeft}>
              <Icon name="identifier" size={22} color={theme.accent} />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Device ID</Text>
                <Text style={styles.rowValue}>{deviceId}</Text>
              </View>
            </View>
            <Icon name="content-copy" size={18} color={theme.textSecondary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('ManageHelpers')}
          >
            <View style={styles.rowLeft}>
              <Icon name="account-group" size={22} color={theme.accent} />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Paired Helpers</Text>
                <Text style={styles.rowValue}>Manage paired devices</Text>
              </View>
            </View>
            <Icon name="chevron-right" size={22} color={theme.textSecondary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row} onPress={handleResetDeviceId}>
            <View style={styles.rowLeft}>
              <Icon name="refresh" size={22} color={theme.danger} />
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: theme.danger }]}>
                  Reset Device ID
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Preferences Section */}
        <Text style={styles.sectionTitle}>PREFERENCES</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.row} onPress={cycleDarkMode}>
            <View style={styles.rowLeft}>
              <Icon name="theme-light-dark" size={22} color={theme.accent} />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Appearance</Text>
                <Text style={styles.rowValue}>{darkModeLabel}</Text>
              </View>
            </View>
            <Icon name="chevron-right" size={22} color={theme.textSecondary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Icon name="vibrate" size={22} color={theme.accent} />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Haptic Feedback</Text>
              </View>
            </View>
            <Switch
              value={preferences.hapticEnabled}
              onValueChange={(v) => updatePreference('hapticEnabled', v)}
              trackColor={{ false: theme.border, true: theme.accent + '80' }}
              thumbColor={preferences.hapticEnabled ? theme.accent : '#f4f3f4'}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Icon name="volume-high" size={22} color={theme.accent} />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Auto Loudspeaker</Text>
                <Text style={styles.rowValue}>Play audio through speaker</Text>
              </View>
            </View>
            <Switch
              value={preferences.autoSpeaker}
              onValueChange={(v) => updatePreference('autoSpeaker', v)}
              trackColor={{ false: theme.border, true: theme.accent + '80' }}
              thumbColor={preferences.autoSpeaker ? theme.accent : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Network Section */}
        <Text style={styles.sectionTitle}>NETWORK</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Icon name="server-network" size={22} color={theme.accent} />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Signal Server</Text>
                <Text style={styles.rowValue} numberOfLines={1}>
                  {SIGNALING_SERVER}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Icon name="speedometer" size={22} color={theme.accent} />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Quality Indicator</Text>
                <Text style={styles.rowValue}>Show during sessions</Text>
              </View>
            </View>
            <Switch
              value={preferences.showQualityBadge}
              onValueChange={(v) => updatePreference('showQualityBadge', v)}
              trackColor={{ false: theme.border, true: theme.accent + '80' }}
              thumbColor={preferences.showQualityBadge ? theme.accent : '#f4f3f4'}
            />
          </View>
        </View>

        {/* About Section */}
        <Text style={styles.sectionTitle}>ABOUT</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Icon name="information-outline" size={22} color={theme.accent} />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Version</Text>
                <Text style={styles.rowValue}>1.0.0 (Beta)</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Icon name="code-tags" size={22} color={theme.accent} />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Developer</Text>
                <Text style={styles.rowValue}>Himangshu Roy</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row} onPress={handleReportBug}>
            <View style={styles.rowLeft}>
              <Icon name="bug-outline" size={22} color={theme.danger} />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Report a Bug</Text>
              </View>
            </View>
            <Icon name="open-in-new" size={18} color={theme.textSecondary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row} onPress={() => {
            if (PRIVACY_POLICY_URL) {
              Linking.openURL(PRIVACY_POLICY_URL);
            } else {
              Alert.alert(
                'Coming Soon',
                'Our privacy policy will be available before the official release.',
              );
            }
          }}>
            <View style={styles.rowLeft}>
              <Icon name="shield-check-outline" size={22} color={theme.accent} />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Privacy Policy</Text>
              </View>
            </View>
            <Icon name="open-in-new" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

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
    scrollContent: {
      paddingHorizontal: 20,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textSecondary,
      letterSpacing: 1,
      marginTop: 24,
      marginBottom: 8,
      marginLeft: 4,
    },
    section: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    rowText: {
      marginLeft: 14,
      flex: 1,
    },
    rowLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    rowValue: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    divider: {
      height: 1,
      backgroundColor: theme.border,
      marginLeft: 52,
    },
  });
