import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import notifee from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ensureChannels } from './src/lib/notifications';
import { displayHeadsUp, handleNotifeeEvent, parseCallData } from './src/lib/incomingCall';
import { navigateToIncomingCall } from './src/navigation/navigationRef';

export default function App() {
  useEffect(() => {
    ensureChannels();

    // Esc3: con la app abierta, un push llega como heads-up (banner) + vibración
    // corta, sin sonido.
    const unsubOnMessage = messaging().onMessage(async (remoteMessage) => {
      const call = parseCallData(remoteMessage.data as Record<string, unknown> | undefined);
      if (call) await displayHeadsUp(call);
    });

    // Eventos de notifee en primer plano: al tocar la notificación, abrir la
    // pantalla de llamada / pendiente.
    const unsubNotifee = notifee.onForegroundEvent((event) =>
      handleNotifeeEvent(event, navigateToIncomingCall),
    );

    return () => {
      unsubOnMessage();
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
