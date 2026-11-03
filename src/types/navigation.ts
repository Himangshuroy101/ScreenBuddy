import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

/**
 * Root-level navigation parameter list for the app.
 */
export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  MainTabs: undefined;
  Broadcaster: { mode: 'sos' | 'adhoc' };
  Helper: { autoJoinRoomId?: string } | undefined;
  ManageHelpers: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  SessionHistory: undefined;
  Settings: undefined;
};

// Convenience aliases
export type SplashScreenProps = NativeStackScreenProps<RootStackParamList, 'Splash'>;
export type OnboardingScreenProps = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;
export type BroadcasterScreenProps = NativeStackScreenProps<RootStackParamList, 'Broadcaster'>;
export type HelperScreenProps = NativeStackScreenProps<RootStackParamList, 'Helper'>;

// Tab Screen Props using CompositeScreenProps to allow navigation to Root stack
export type HomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;
export type SessionHistoryScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'SessionHistory'>,
  NativeStackScreenProps<RootStackParamList>
>;
export type SettingsScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Settings'>,
  NativeStackScreenProps<RootStackParamList>
>;
// ManageHelpers is still accessed from Settings pushing a screen? 
// Wait, if ManageHelpers is not in Tabs, it must be in the RootStack
export type ManageHelpersScreenProps = NativeStackScreenProps<RootStackParamList, 'ManageHelpers'>;

