import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import notifee from '@notifee/react-native';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { PanelScreen } from '../screens/PanelScreen';
import { HistorialScreen } from '../screens/HistorialScreen';
import { PreferencesScreen } from '../screens/PreferencesScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { IncomingCallScreen } from '../screens/IncomingCallScreen';
import { RootStackParamList } from '../types/db';
import { isOnboardingDone } from '../lib/preferences';
import { navigationRef, navigateToIncomingCall } from './navigationRef';
import { callToRoute, parseCallData } from '../lib/incomingCall';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

function LogoutButton() {
  const { signOut } = useAuth();
  return (
    <Pressable onPress={() => signOut()} style={styles.headerBtn} hitSlop={8}>
      <Text style={styles.headerText}>Salir</Text>
    </Pressable>
  );
}

function PanelHeaderRight() {
  const navigation = useNavigation();
  return (
    <View style={styles.headerRight}>
      <Pressable
        onPress={() => navigation.navigate('Preferences' as never)}
        style={styles.headerBtn}
        hitSlop={8}
      >
        <Text style={styles.gear}>⚙️</Text>
      </Pressable>
      <LogoutButton />
    </View>
  );
}

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

function MeseroTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#D32F2F' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '800' },
        tabBarActiveTintColor: '#D32F2F',
      }}
    >
      <Tab.Screen
        name="Panel"
        component={PanelScreen}
        options={{
          title: 'Panel',
          headerRight: () => <PanelHeaderRight />,
          tabBarIcon: ({ focused }) => <TabIcon emoji="🔔" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Historial"
        component={HistorialScreen}
        options={{
          title: 'Historial',
          headerRight: () => <LogoutButton />,
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

function AppStack({ onboardingDone }: { onboardingDone: boolean }) {
  return (
    <Stack.Navigator
      initialRouteName={onboardingDone ? 'Tabs' : 'Onboarding'}
      screenOptions={{
        headerStyle: { backgroundColor: '#D32F2F' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Tabs" component={MeseroTabs} options={{ headerShown: false }} />
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
        <ActivityIndicator size="large" color="#D32F2F" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} onReady={onReady}>
      {session ? <AppStack onboardingDone={!!onboardingDone} /> : <LoginScreen />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerBtn: { marginRight: 14, paddingVertical: 4, paddingHorizontal: 6 },
  headerText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  gear: { fontSize: 18 },
});
