import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import notifee from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { PanelScreen } from '../screens/PanelScreen';
import { PreferencesScreen } from '../screens/PreferencesScreen';
import { IncomingCallScreen } from '../screens/IncomingCallScreen';
import { RootStackParamList } from '../types/db';
import { navigationRef, flushPendingCall } from './navigationRef';
import { callToRoute, parseCallData } from '../lib/incomingCall';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

type CallRoute = RootStackParamList['IncomingCall'];

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg },
};

function AppStack({ initialCall }: { initialCall: CallRoute | null }) {
  // Si la app se abrió tocando una notificación de llamada/pedido, arrancamos
  // DIRECTO en IncomingCallScreen (con sus params); si no, en el panel.
  const initialRouteName: keyof RootStackParamList = initialCall ? 'IncomingCall' : 'Tabs';

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.gold,
        headerTitleStyle: { fontWeight: '900', color: colors.gold },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="Tabs" component={PanelScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Preferences" component={PreferencesScreen} options={{ title: 'Preferencias' }} />
      <Stack.Screen
        name="IncomingCall"
        component={IncomingCallScreen}
        initialParams={initialCall ?? undefined}
        options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}

export function RootNavigator() {
  const { session, loading } = useAuth();
  // undefined = todavía resolviendo la notificación inicial; null = no hubo.
  const [initialCall, setInitialCall] = useState<CallRoute | null | undefined>(undefined);

  // Resolvemos la notificación que abrió la app (app CERRADA/quit) ANTES de
  // renderizar el stack, para poder usarla como ruta inicial. Cubrimos las dos
  // fuentes: notifee (FSI/snooze) y FCM del sistema (bloque `notification`).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let call = null;
      try {
        const n = await notifee.getInitialNotification();
        call = parseCallData(n?.notification?.data as Record<string, unknown> | undefined);
        // eslint-disable-next-line no-console
        console.log('[TRACE] getInitialNotification notifee=' + JSON.stringify(call));
      } catch {
        // ignorar
      }
      if (!call) {
        try {
          const f = await messaging().getInitialNotification();
          call = parseCallData(f?.data as Record<string, unknown> | undefined);
          // eslint-disable-next-line no-console
          console.log('[TRACE] getInitialNotification notifee=' + JSON.stringify(call));
        } catch {
          // ignorar
        }
      }
      if (!cancelled) setInitialCall(call ? callToRoute(call) : null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || initialCall === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} onReady={flushPendingCall}>
      {session ? <AppStack initialCall={initialCall} /> : <LoginScreen />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
