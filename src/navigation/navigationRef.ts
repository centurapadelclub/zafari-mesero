import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from '../types/db';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Cola de "ruta pendiente": si un evento PRESS de notificación llega ANTES de que
// el navigator esté montado (arranque en frío desde app cerrada), guardamos los
// params acá en vez de descartar la navegación. flushPendingCall() la drena en
// cuanto el navigator esté listo (onReady).
let pendingCall: RootStackParamList['IncomingCall'] | null = null;

/** Navega a la pantalla de llamada entrante; si el navigator aún no está montado,
 *  deja los params en cola (pendingCall) para no perder la navegación. */
export function navigateToIncomingCall(params: RootStackParamList['IncomingCall']): void {
  // eslint-disable-next-line no-console
  console.log('[TRACE] navigateToIncomingCall isReady=' + navigationRef.isReady() + ' params=' + JSON.stringify(params));
  if (navigationRef.isReady()) {
    navigationRef.navigate('IncomingCall', params);
    pendingCall = null;
  } else {
    // eslint-disable-next-line no-console
    console.log('[TRACE] guardado en pendingCall');
    pendingCall = params;
  }
}

/** Drena la navegación pendiente (si la hay y el navigator ya está listo). Se
 *  llama desde el onReady del NavigationContainer. */
export function flushPendingCall(): void {
  // eslint-disable-next-line no-console
  console.log('[TRACE] flushPendingCall pendingCall=' + JSON.stringify(pendingCall) + ' isReady=' + navigationRef.isReady());
  if (pendingCall && navigationRef.isReady()) {
    const params = pendingCall;
    pendingCall = null;
    navigationRef.navigate('IncomingCall', params);
  }
}
