import { registerRootComponent } from 'expo';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseCallData, displayIncomingCall, callToRoute } from './src/lib/incomingCall';
import { navigateToIncomingCall } from './src/navigation/navigationRef';
import { ensureChannels, CHANNEL_HEADSUP } from './src/lib/notifications';
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
    // 🔎 PRUEBA 1 (NO depende del permiso de notificaciones): dejamos una marca
    // con timestamp en AsyncStorage. Si el handler corrió, el login la muestra
    // la próxima vez que abrís la app — aunque la notificación no se vea.
    try {
      await AsyncStorage.setItem(
        'zafari.debug.lastBg',
        JSON.stringify({ t: new Date().toISOString(), data: remoteMessage.data ?? null }),
      );
    } catch {
      // ignorar
    }

    // 🔎 PRUEBA 2 (depende de POST_NOTIFICATIONS): notificación incondicional.
    // Si aparece, el handler corrió Y hay permiso. Si NO aparece pero la marca
    // de arriba sí actualizó, el handler corrió pero falta permiso/canal.
    try {
      await ensureChannels();
      await notifee.displayNotification({
        title: 'BG handler OK',
        body: JSON.stringify(remoteMessage.data ?? {}),
        android: { channelId: CHANNEL_HEADSUP },
      });
    } catch (dbgErr) {
      // eslint-disable-next-line no-console
      console.error('[index] debug notification falló:', dbgErr);
    }

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
