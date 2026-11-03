import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import BroadcasterScreen from './src/screens/BroadcasterScreen';
import HelperScreen from './src/screens/HelperScreen';
import SplashScreen from './src/screens/SplashScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import ManageHelpersScreen from './src/screens/ManageHelpersScreen';
import MainTabs from './src/navigation/MainTabs';
import ErrorBoundary from './src/components/ErrorBoundary';
import { PreferencesProvider } from './src/context/PreferencesContext';

import type { RootStackParamList } from './src/types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Deep linking configuration
const linking = {
  prefixes: ['screenbuddy://'],
  config: {
    screens: {
      Helper: {
        path: 'helper/:autoJoinRoomId?',
      },
    },
  },
};

function App() {
  return (
    <ErrorBoundary>
      <PreferencesProvider>
        <SafeAreaProvider>
          <NavigationContainer linking={linking}>
            <Stack.Navigator
              initialRouteName="Splash"
              screenOptions={{ headerShown: false }}
            >
              <Stack.Screen name="Splash" component={SplashScreen} />
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              <Stack.Screen name="MainTabs" component={MainTabs} />
              <Stack.Screen
                name="Broadcaster"
                component={BroadcasterScreen}
                options={{ title: 'Sharing Screen' }}
              />
              <Stack.Screen
                name="Helper"
                component={HelperScreen}
                options={{ title: 'Remote View' }}
              />
              <Stack.Screen
                name="ManageHelpers"
                component={ManageHelpersScreen}
                options={{ title: 'Paired Helpers' }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </SafeAreaProvider>
      </PreferencesProvider>
    </ErrorBoundary>
  );
}

export default App;