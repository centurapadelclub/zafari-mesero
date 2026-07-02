import { registerRootComponent } from 'expo';
import notifee, { EventType } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';

import { parseCallData, displayIncomingCall, callToRoute } from './src/lib/incomingCall';
import { navigateToIncomingCall } from './src/navigation/navigationRef';
import { installGlobalErrorHandler } from './src/lib/errorReporting';

import App from './App';

// Capturar errores JS no atrapados (los logea en vez de cerrar en silencio).
installGlobalErrorHandler();

/**
 * Esc2 (app en segundo plano o CERRADA): handler de background de RNFirebase.
 * Envuelto en try-catch: si el módulo nativo no está disponible, NO tumba la app
 * al iniciar (solo se pierde el push en background, que se diagnostica aparte).
 */
try {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    try {
      const call = parseCallData(remoteMessage.data as Record<string, unknown> | undefined);
      if (call) await displayIncomingCall(call);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[index] error en background message handler:', err);
    }
  });
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('[index] messaging() no disponible (setBackgroundMessageHandler):', err);
}

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
