import { registerRootComponent } from 'expo';
import notifee, { EventType } from '@notifee/react-native';

// Define la tarea de background para el push (Esc2) al cargar el módulo.
import './src/lib/backgroundTask';
import { parseCallData } from './src/lib/incomingCall';
import { navigateToIncomingCall } from './src/navigation/navigationRef';
import { callToRoute } from './src/lib/incomingCall';

import App from './App';

/**
 * Handler de eventos de notifee en segundo plano (app en background/cerrada).
 * Debe registrarse en el nivel superior (fuera de cualquier componente).
 * Si el usuario toca la notificación de llamada, al abrir la app el ruteo
 * definitivo lo hace getInitialNotification (ver RootNavigator); acá cubrimos
 * el caso en que el navigator ya esté listo.
 */
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS) {
    const call = parseCallData(detail.notification?.data as Record<string, unknown> | undefined);
    if (call) navigateToIncomingCall(callToRoute(call));
  }
});

// registerRootComponent llama a AppRegistry.registerComponent('main', () => App)
registerRootComponent(App);
