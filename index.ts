import { registerRootComponent } from 'expo';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';

import {
  parseCallData,
  displayIncomingCall,
  callToRoute,
  savePendingIncomingCall,
} from './src/lib/incomingCall';
import { navigateToIncomingCall } from './src/navigation/navigationRef';
import { setShowWhenLocked, isKeyguardLocked } from './modules/lock-screen';
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
    // eslint-disable-next-line no-console
    console.log('[TRACE] bg handler recibió push, call=' + JSON.stringify(call));
    if (call) {
      // Persistir ANTES de mostrar: el push REVIVE la app sin tap, así que
      // getInitialNotification devolverá null; esta es la única fuente segura
      // del call para arrancar en IncomingCall al montar (ver RootNavigator).
      await savePendingIncomingCall(call);
      // eslint-disable-next-line no-console
      console.log('[TRACE] persistió call en storage');
      // displayIncomingCall arma el Full Screen Intent: ESE es el mecanismo que
      // trae la ventana al frente sobre el bloqueo (tanto cold como warm start).
      await displayIncomingCall(call);
      // eslint-disable-next-line no-console
      console.log('[TRACE] bg handler llamó displayIncomingCall');
      // WARM START (app VIVA en background): el push data-only entra por este
      // handler pero RootNavigator NO se re-monta ni onCreate corre. Diferenciamos
      // según el estado del keyguard (comportamiento tipo WhatsApp):
      //  - BLOQUEADO: forzar la pantalla sobre el lock. setShowWhenLocked(true)
      //    marca la Activity existente para mostrarse sobre el bloqueo cuando el
      //    FSI la traiga al frente (onCreate no corre en warm); navigate deja el
      //    JS en la pantalla correcta.
      //  - DESBLOQUEADO: NO forzar (Android 14 no lo permite sin consentimiento y
      //    el usuario está usando el cel). Solo el heads-up que Android degrada
      //    del FSI; el mesero toca el banner (launchActivity 'default' foregroundea
      //    + onBackgroundEvent PRESS navega).
      //  - null (build sin isKeyguardLocked todavía): default SEGURO = tratar como
      //    bloqueado (no arriesgar perder el caso crítico sobre el lock).
      try {
        const locked = isKeyguardLocked();
        // eslint-disable-next-line no-console
        console.log('[TRACE] warm start keyguard locked=' + locked);
        if (locked === false) {
          // eslint-disable-next-line no-console
          console.log('[TRACE] warm start: desbloqueado, solo heads-up (esperar tap)');
        } else {
          setShowWhenLocked(true);
          navigateToIncomingCall(callToRoute(call));
          // eslint-disable-next-line no-console
          console.log('[TRACE] warm start: bloqueado, setShowWhenLocked + navigate');
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[index] warm start keyguard/navigate falló:', e);
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[index] error en background message handler:', err);
  }
});

/**
 * Runner del Foreground Service (notifee lo exige registrado a nivel global).
 * Mantiene el servicio vivo hasta stopForegroundService(); el trabajo real de los
 * push lo hace el setBackgroundMessageHandler de arriba, así que la promesa no
 * resuelve por sí sola.
 */
try {
  notifee.registerForegroundService(
    () =>
      new Promise(() => {
        // keep-alive: el runner vive hasta stopForegroundService(). No hace
        // trabajo propio (el bg handler procesa los push). Si en el futuro se
        // agrega lógica acá, debe ir envuelta en try-catch para no matar el
        // service.
      }),
  );
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('[index] registerForegroundService no disponible:', err);
}

// Capturar errores JS no atrapados (los logea en vez de cerrar en silencio).
installGlobalErrorHandler();

/** Handler de eventos de notifee en segundo plano (envuelto por seguridad). */
try {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    try {
      // eslint-disable-next-line no-console
      console.log('[TRACE] onBackgroundEvent type=' + type);
      if (type === EventType.PRESS) {
        const call = parseCallData(detail.notification?.data as Record<string, unknown> | undefined);
        // eslint-disable-next-line no-console
        console.log('[TRACE] onBackgroundEvent PRESS call=' + JSON.stringify(call));
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
