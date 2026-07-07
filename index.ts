import { registerRootComponent } from 'expo';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';

import { parseCallData, displayIncomingCall, callToRoute } from './src/lib/incomingCall';
import { navigateToIncomingCall } from './src/navigation/navigationRef';
import { installGlobalErrorHandler } from './src/lib/errorReporting';

import App from './App';

/**
 * ⚠️ LO PRIMERO DE TODO (nivel superior del archivo, antes que cualquier otro
 * código): el handler de mensajes FCM en segundo plano / app CERRADA. RNFirebase
 * exige registrarlo en el scope global — si se registra tarde o dentro de un
 * componente/useEffect, los push con la app cerrada NO se procesan.
 *
 * Esc2: el mensaje es data-only de alta prioridad; acá lo convertimos en la
 * llamada entrante a pantalla completa (Full Screen Intent de notifee).
 */
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  try {
    const call = parseCallData(remoteMessage.data as Record<string, unknown> | undefined);
    if (call) await displayIncomingCall(call);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[index] error en background message handler:', err);
  }
});

// Capturar errores JS no atrapados (los logea en vez de cerrar en silencio).
installGlobalErrorHandler();

/** Handler de eventos de notifee en segundo plano (envuelto por seguridad). */
try {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    try {
      if (type === EventType.PRESS) {
        const call = parseCallData(detail.notification?.data as Record<string, unknown> | undefined);
        if (call) navigateToIncomingCall(callToRoute(call));
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[index] error en notifee background event:', err);
    }
  });
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('[index] notifee.onBackgroundEvent no disponible:', err);
}

// registerRootComponent llama a AppRegistry.registerComponent('main', () => App)
registerRootComponent(App);
