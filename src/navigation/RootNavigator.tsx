import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import notifee from '@notifee/react-native';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { PanelScreen } from '../screens/PanelScreen';
import { PreferencesScreen } from '../screens/PreferencesScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { IncomingCallScreen } from '../screens/IncomingCallScreen';
import { RootStackParamList } from '../types/db';
import { isOnboardingDone } from '../lib/preferences';
import { navigationRef, navigateToIncomingCall } from './navigationRef';
import { callToRoute, parseCallData } from '../lib/incomingCall';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg },
};

function AppStack({ onboardingDone }: { onboardingDone: boolean }) {
  return (
    <Stack.Navigator
      initialRouteName={onboardingDone ? 'Tabs' : 'Onboarding'}
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.gold,
        headerTitleStyle: { fontWeight: '900', color: colors.gold },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Tabs" component={PanelScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Preferences" component={PreferencesScreen} options={{ title: 'Preferencias' }} />
      <Stack.Screen
        name="IncomingCall"
        component={IncomingCallScreen}
        options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}

export function RootNavigator() {
  const { session, loading } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    isOnboardingDone().then(setOnboardingDone);
  }, [session?.id]);

  // Al abrir la app desde una notificación de llamada (Esc2, app cerrada),
  // rutear a la pantalla de llamada entrante.
  const onReady = async () => {
    const initial = await notifee.getInitialNotification();
    const call = parseCallData(initial?.notification?.data as Record<string, unknown> | undefined);
    if (call) navigateToIncomingCall(callToRoute(call));
  };

  if (loading || (session && onboardingDone === null)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} onReady={onReady}>
      {session ? <AppStack onboardingDone={!!onboardingDone} /> : <LoginScreen />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
