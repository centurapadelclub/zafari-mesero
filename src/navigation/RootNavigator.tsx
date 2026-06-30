import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { PanelScreen } from '../screens/PanelScreen';
import { HistorialScreen } from '../screens/HistorialScreen';
import { stopInsistentVibration } from '../lib/notifications';

const Tab = createBottomTabNavigator();

function LogoutButton() {
  const { signOut } = useAuth();
  return (
    <Pressable
      onPress={() => {
        stopInsistentVibration();
        signOut();
      }}
      style={styles.logoutBtn}
      hitSlop={8}
    >
      <Text style={styles.logoutText}>Salir</Text>
    </Pressable>
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
        headerRight: () => <LogoutButton />,
        tabBarActiveTintColor: '#D32F2F',
      }}
    >
      <Tab.Screen
        name="Panel"
        component={PanelScreen}
        options={{
          title: 'Panel',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🔔" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Historial"
        component={HistorialScreen}
        options={{
          title: 'Historial',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#D32F2F" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {session ? <MeseroTabs /> : <LoginScreen />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  logoutBtn: { marginRight: 14, paddingVertical: 4, paddingHorizontal: 8 },
  logoutText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
