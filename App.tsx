import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import notifee from '@notifee/react-native';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ensureChannels, vibrateShort } from './src/lib/notifications';
import { registerBackgroundPushTask } from './src/lib/backgroundTask';
import { handleNotifeeEvent } from './src/lib/incomingCall';
import { navigateToIncomingCall } from './src/navigation/navigationRef';

export default function App() {
  useEffect(() => {
    ensureChannels();
    registerBackgroundPushTask();

    // Esc3: con la app abierta, un push llega como heads-up (banner) + vibración
    // corta, sin sonido.
    const received = Notifications.addNotificationReceivedListener(() => vibrateShort());

    // Eventos de notifee en primer plano: al tocar la llamada, abrir la pantalla.
    const unsubNotifee = notifee.onForegroundEvent((event) =>
      handleNotifeeEvent(event, navigateToIncomingCall),
    );

    return () => {
      received.remove();
      unsubNotifee();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
