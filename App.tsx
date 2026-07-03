import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import notifee from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import ErrorBoundary from './src/components/ErrorBoundary';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ensureChannels } from './src/lib/notifications';
import { displayHeadsUp, handleNotifeeEvent, parseCallData } from './src/lib/incomingCall';
import { navigateToIncomingCall } from './src/navigation/navigationRef';

export default function App() {
  // Al abrir la app: buscar y aplicar el OTA automáticamente. Solo corre en
  // builds con updates habilitado (en dev/Expo Go se omite para no hacer ruido).
  useEffect(() => {
    async function checkUpdate() {
      if (!Updates.isEnabled) return;
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('Update check failed:', e);
      }
    }
    checkUpdate();
  }, []);

  useEffect(() => {
    // Cada bloque va protegido: si un módulo nativo no está disponible, no debe
    // tumbar el arranque de la app.
    try {
      ensureChannels();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[App] ensureChannels falló:', err);
    }

    let unsubOnMessage = () => {};
    try {
      // Esc3: con la app abierta, un push llega como heads-up + vibración corta.
      unsubOnMessage = messaging().onMessage(async (remoteMessage) => {
        try {
          const call = parseCallData(remoteMessage.data as Record<string, unknown> | undefined);
          if (call) await displayHeadsUp(call);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[App] error en onMessage:', err);
        }
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[App] messaging().onMessage no disponible:', err);
    }

    let unsubNotifee = () => {};
    try {
      unsubNotifee = notifee.onForegroundEvent((event) =>
        handleNotifeeEvent(event, navigateToIncomingCall),
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[App] notifee.onForegroundEvent no disponible:', err);
    }

    return () => {
      try {
        unsubOnMessage();
      } catch {
        // ignorar
      }
      try {
        unsubNotifee();
      } catch {
        // ignorar
      }
    };
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
