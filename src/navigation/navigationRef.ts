import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from '../types/db';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Cola de "ruta pendiente": si un evento PRESS de notificación llega ANTES de que
// el navigator esté montado (arranque en frío desde app cerrada), guardamos los
// params acá en vez de descartar la navegación. flushPendingCall() la drena en
// cuanto el navigator esté listo (onReady).
//
// Guardamos además un timestamp: durante el cold start pueden acumularse varios
// PRESS (llamados viejos) y pendingCall se sobreescribe. Si al drenar el pendiente
// tiene más de STALE_MS de antigüedad, lo descartamos (llamado rancio) para no
// abrir una llamada vieja en vez de la que realmente abrió la app.
const STALE_MS = 15000;
let pendingCall: RootStackParamList['IncomingCall'] | null = null;
let pendingCallAt = 0;

/** Navega a la pantalla de llamada entrante; si el navigator aún no está montado,
 *  deja los params en cola (pendingCall) para no perder la navegación. */
export function navigateToIncomingCall(params: RootStackParamList['IncomingCall']): void {
  if (navigationRef.isReady()) {
    navigationRef.navigate('IncomingCall', params);
    pendingCall = null;
    pendingCallAt = 0;
  } else {
    pendingCall = params;
    pendingCallAt = Date.now();
  }
}

/** Limpia cualquier ruta pendiente acumulada. Se usa cuando getInitialNotification
 *  ya resolvió el llamado correcto que abrió la app (initialCall): ese tiene
 *  prioridad y no queremos que flushPendingCall pise la ruta inicial con un
 *  llamado viejo encolado durante el cold start. */
export function clearPendingCall(): void {
  pendingCall = null;
  pendingCallAt = 0;
}

/** Drena la navegación pendiente (si la hay y el navigator ya está listo). Se
 *  llama desde el onReady del NavigationContainer. */
export function flushPendingCall(): void {
  if (pendingCall && navigationRef.isReady()) {
    // Descartar llamados rancios acumulados durante el cold start.
    if (Date.now() - pendingCallAt > STALE_MS) {
      pendingCall = null;
      pendingCallAt = 0;
      return;
    }
    const params = pendingCall;
    pendingCall = null;
    pendingCallAt = 0;
    navigationRef.navigate('IncomingCall', params);
  }
}
