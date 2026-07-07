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
import {
  displayIncomingCall,
  handleNotifeeEvent,
  parseCallData,
  callToRoute,
} from './src/lib/incomingCall';
import { navigateToIncomingCall } from './src/navigation/navigationRef';

export default function App() {
  // Al abrir la app: buscar y DESCARGAR el OTA, pero NO reiniciar en caliente.
  // El update descargado se aplica solo en el SIGUIENTE arranque natural de la
  // app. Así evitamos el ciclo de crash (descargar -> reload -> crash -> rollback)
  // si un bundle sale defectuoso. Solo corre en builds con updates habilitado.
  useEffect(() => {
    async function checkUpdate() {
      if (!Updates.isEnabled) return;
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync(); // queda listo para el próximo arranque
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
      // Foreground: SIEMPRE registramos una notificación nativa de Android
      // (notifee.displayNotification con el canal de llamada). La pantalla
      // IncomingCallScreen aparece además vía el evento de notifee (DELIVERED).
      // Antes se usaba un heads-up efímero (timeoutAfter/autoCancel) que no
      // quedaba en la barra; ahora usamos el mismo display persistente que en
      // background, así la notificación queda registrada en foreground también.
      unsubOnMessage = messaging().onMessage(async (remoteMessage) => {
        try {
          const call = parseCallData(remoteMessage.data as Record<string, unknown> | undefined);
          if (call) await displayIncomingCall(call);
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

    // App EN BACKGROUND y el mesero toca la notificación del SISTEMA (bloque
    // `notification` de FCM): RNFirebase entrega el tap acá (no notifee, porque
    // la notificación la mostró Android, no notifee). Navegamos a la llamada.
    let unsubOpened = () => {};
    try {
      unsubOpened = messaging().onNotificationOpenedApp((remoteMessage) => {
        try {
          const call = parseCallData(remoteMessage?.data as Record<string, unknown> | undefined);
          if (call) navigateToIncomingCall(callToRoute(call));
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[App] error en onNotificationOpenedApp:', err);
        }
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[App] messaging().onNotificationOpenedApp no disponible:', err);
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
      try {
        unsubOpened();
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
