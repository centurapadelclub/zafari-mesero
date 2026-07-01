import { registerRootComponent } from 'expo';
import notifee, { EventType } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';

import { parseCallData, displayIncomingCall, callToRoute } from './src/lib/incomingCall';
import { navigateToIncomingCall } from './src/navigation/navigationRef';

import App from './App';

/**
 * Esc2 (app en segundo plano o CERRADA): handler de background de RNFirebase.
 * Cuando llega el push data-only, arma la llamada entrante a pantalla completa
 * (notifee Full Screen Intent). Es el camino robusto para celulares que matan
 * procesos (Xiaomi/Huawei/Samsung viejos). DEBE registrarse en el nivel superior.
 */
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  const call = parseCallData(remoteMessage.data as Record<string, unknown> | undefined);
  if (call) await displayIncomingCall(call);
});

/**
 * Handler de eventos de notifee en segundo plano: si el usuario toca la
 * notificación de llamada, al abrir la app se rutea a la pantalla.
 */
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS) {
    const call = parseCallData(detail.notification?.data as Record<string, unknown> | undefined);
    if (call) navigateToIncomingCall(callToRoute(call));
  }
});

// registerRootComponent llama a AppRegistry.registerComponent('main', () => App)
registerRootComponent(App);
