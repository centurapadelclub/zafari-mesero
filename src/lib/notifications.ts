import { Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import notifee, { AndroidImportance, AndroidVisibility } from '@notifee/react-native';
import { supabase } from './supabase';
import { Id } from '../types/db';
import { getSoundPref } from './preferences';

/**
 * Notificaciones de la app del mesero — 3 escenarios (ver README):
 *
 *  Esc1 (deslogueado): no llega nada. El token se registra SOLO al loguear y se
 *        borra al desloguear (savePushToken / deletePushToken).
 *  Esc2 (pantalla apagada / celular guardado): llamada entrante a pantalla
 *        completa (Full Screen Intent con notifee) + vibración tipo teléfono
 *        (fuerte-suave) por máx 10 s + sonido según preferencia.
 *  Esc3 (celular en uso): heads-up (banner) + vibración corta tipo WhatsApp,
 *        SIN sonido, auto-dismiss ~5 s.
 */

// ---- Canales ----
export const CHANNEL_HEADSUP = 'llamados'; // Esc3
export const CHANNEL_CALL_SOUND = 'llamado-call-sound'; // Esc2 con sonido
export const CHANNEL_CALL_SILENT = 'llamado-call-silent'; // Esc2 solo vibración

// ---- Patrones de vibración ----
// Esc3: corto, una sola vez ("brr brr").
const PATTERN_SHORT = [0, 250, 150, 250];
// Esc2: tipo llamada telefónica, fuerte-suave, repetido (se corta a los 10 s).
const PATTERN_CALL = [0, 800, 300, 500, 300];
const CALL_VIBRATION_MAX_MS = 10000;

/**
 * Handler en primer plano (expo-notifications): cuando llega un push con la app
 * abierta mostramos banner (Esc3), sin sonido. La vibración corta la hace
 * vibrateShort() desde el listener (ver App.tsx).
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false, // Esc3: sin sonido
    shouldSetBadge: false,
  }),
});

/** Crea/actualiza los canales de notificación. Idempotente. */
export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  // Esc3: heads-up con vibración corta y SIN sonido.
  await Notifications.setNotificationChannelAsync(CHANNEL_HEADSUP, {
    name: 'Llamados (en uso)',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: PATTERN_SHORT,
    enableVibrate: true,
    sound: null, // sin sonido
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  // Esc2: canales para la llamada entrante (Full Screen Intent lo arma notifee).
  await notifee.createChannel({
    id: CHANNEL_CALL_SOUND,
    name: 'Llamada entrante (sonido)',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'default',
    vibration: true,
    vibrationPattern: PATTERN_CALL,
    bypassDnd: true,
  });
  await notifee.createChannel({
    id: CHANNEL_CALL_SILENT,
    name: 'Llamada entrante (solo vibración)',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    vibration: true,
    vibrationPattern: PATTERN_CALL,
    bypassDnd: true,
  });
}

/** El canal de la llamada entrante según la preferencia de sonido guardada. */
export async function callChannelForPref(): Promise<string> {
  const pref = await getSoundPref();
  return pref === 'vibration_only' ? CHANNEL_CALL_SILENT : CHANNEL_CALL_SOUND;
}

// ---- Permisos ----
export async function requestNotificationPermissions(): Promise<boolean> {
  await ensureChannels();
  const settings = await Notifications.getPermissionsAsync();
  let status = settings.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: true },
    });
    status = req.status;
  }
  return status === 'granted';
}

// ---- Token FCM ----
export async function getFcmDeviceToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const granted = await requestNotificationPermissions();
  if (!granted) return null;
  try {
    const token = await Notifications.getDevicePushTokenAsync();
    return typeof token.data === 'string' ? token.data : String(token.data);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[notifications] No se pudo obtener el token FCM:', err);
    return null;
  }
}

/** Esc1: guarda el token (upsert por token) al loguear. */
export async function savePushToken(meseroId: Id): Promise<void> {
  try {
    const token = await getFcmDeviceToken();
    if (!token) return;
    const { error } = await supabase.from('push_tokens').upsert(
      { mesero_id: meseroId, token, platform: Platform.OS, updated_at: new Date().toISOString() },
      { onConflict: 'token' },
    );
    if (error) console.warn('[notifications] No se pudo guardar el token:', error.message);
  } catch (err) {
    console.warn('[notifications] Error registrando token:', err);
  }
}

/**
 * Esc1: elimina el token de este dispositivo al desloguear, para que NO le
 * lleguen más notificaciones. Borra por token (este device); si no se puede
 * obtener el token, borra todos los del mesero como fallback.
 */
export async function deletePushToken(meseroId: Id): Promise<void> {
  try {
    const token = await getFcmDeviceToken();
    const q = supabase.from('push_tokens').delete();
    const { error } = token
      ? await q.eq('token', token)
      : await q.eq('mesero_id', meseroId);
    if (error) console.warn('[notifications] No se pudo borrar el token:', error.message);
  } catch (err) {
    console.warn('[notifications] Error borrando token:', err);
  }
}

// ---- Vibraciones por escenario ----

/** Esc3: vibración corta, una sola vez. */
export function vibrateShort(): void {
  Vibration.vibrate(PATTERN_SHORT);
}

let callTimer: ReturnType<typeof setTimeout> | null = null;

/** Esc2: vibración tipo llamada (fuerte-suave) repetida, se corta sola a los 10 s. */
export function startCallVibration(): void {
  stopCallVibration();
  Vibration.vibrate(PATTERN_CALL, true);
  callTimer = setTimeout(stopCallVibration, CALL_VIBRATION_MAX_MS);
}

/** Corta la vibración de llamada (al atender, ignorar o a los 10 s). */
export function stopCallVibration(): void {
  if (callTimer) {
    clearTimeout(callTimer);
    callTimer = null;
  }
  Vibration.cancel();
}
