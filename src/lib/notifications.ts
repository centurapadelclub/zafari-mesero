import { Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from './supabase';
import { Id } from '../types/db';

/**
 * Configuración de notificaciones para la app del mesero.
 *
 * Requisitos del cliente (Android):
 *  1. Canal de prioridad MAX  -> heads-up (aparece en pantalla aunque la app
 *     no esté abierta) y suena/vibra por encima de otras notificaciones.
 *  2. Vibración insistente    -> patrón de 5 s vibrando / 5 s pausa, repitiendo
 *     hasta que el mesero atienda el llamado (ver startInsistentVibration).
 *  3. Heads-up / pantalla bloqueada -> visibilidad PUBLIC + WAKE_LOCK +
 *     USE_FULL_SCREEN_INTENT (permisos declarados en app.config.ts).
 *
 * NOTA IMPORTANTE sobre los límites de Android:
 *  - El `vibrationPattern` de un canal SOLO se reproduce una vez cuando llega la
 *    notificación; Android no repite el patrón del canal indefinidamente. Por
 *    eso la vibración "hasta que atienda" se implementa en la app con la API
 *    Vibration (startInsistentVibration), que SÍ repite. Esto funciona mientras
 *    la app está en primer plano o se abre al tocar la notificación.
 *  - Una verdadera notificación a pantalla completa estilo "llamada entrante"
 *    sobre la pantalla de bloqueo (full-screen intent) y vibración persistente
 *    con la app cerrada requieren un Foreground Service nativo. Eso excede el
 *    flujo managed de Expo y necesitaría un módulo/config-plugin nativo propio.
 *    Lo dejo documentado en el README; aquí se cubre todo lo posible en managed.
 */

// ---- Canal de notificación ----
export const LLAMADO_CHANNEL_ID = 'llamados';

/**
 * Patrón de vibración insistente: [esperar, vibrar, pausa, ...]
 * 0 ms de espera, 5000 ms vibrando, 5000 ms en pausa.
 * Con `repeat = true` en Vibration.vibrate se repite hasta cancelar.
 */
const INSISTENT_PATTERN = [0, 5000, 5000];

/**
 * Handler global: define cómo se muestra una notificación cuando la app está
 * en primer plano. Mostramos banner + lista + sonido para que el mesero la vea
 * aunque tenga la app abierta.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Crea/actualiza el canal Android de "llamados" con prioridad MAX y vibración.
 * Idempotente: se puede llamar en cada arranque.
 */
export async function ensureLlamadosChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(LLAMADO_CHANNEL_ID, {
    name: 'Llamados de mesa',
    description: 'Llamados y pedidos urgentes asignados a tus zonas',
    importance: Notifications.AndroidImportance.MAX, // heads-up + máxima prioridad
    vibrationPattern: INSISTENT_PATTERN,
    enableVibrate: true,
    enableLights: true,
    lightColor: '#D32F2F',
    sound: 'default',
    // Mostrar contenido completo aunque la pantalla esté bloqueada.
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    // Sonar/vibrar aunque esté activado "No molestar".
    bypassDnd: true,
    showBadge: true,
  });
}

/**
 * Pide permiso de notificaciones (Android 13+ / iOS) y asegura el canal.
 * Devuelve true si quedaron concedidos.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  await ensureLlamadosChannel();

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

/**
 * Obtiene el token de push NATIVO del dispositivo (token FCM en Android).
 * Este es el token que tu backend / Edge Function de Supabase debe guardar y
 * usar para enviar la notificación vía FCM v1.
 *
 * Requiere un dev build / build de producción con google-services.json (no
 * funciona en Expo Go). Devuelve null si no se puede obtener.
 */
export async function getFcmDeviceToken(): Promise<string | null> {
  if (!Device.isDevice) {
    // eslint-disable-next-line no-console
    console.warn('[notifications] El push solo funciona en un dispositivo físico.');
    return null;
  }

  const granted = await requestNotificationPermissions();
  if (!granted) return null;

  try {
    const token = await Notifications.getDevicePushTokenAsync();
    // token.data es el registration token de FCM en Android.
    return typeof token.data === 'string' ? token.data : String(token.data);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[notifications] No se pudo obtener el token FCM:', err);
    return null;
  }
}

// ---- Vibración insistente controlada desde la app ----
let vibrating = false;

/**
 * Inicia la vibración insistente (5 s on / 5 s off, repitiendo). Idempotente:
 * si ya está vibrando no reinicia el patrón.
 */
export function startInsistentVibration(): void {
  if (vibrating) return;
  vibrating = true;
  // El segundo argumento `true` hace que el patrón se repita indefinidamente.
  Vibration.vibrate(INSISTENT_PATTERN, true);
}

/** Detiene la vibración insistente. Llamar cuando el mesero atiende el llamado. */
export function stopInsistentVibration(): void {
  if (!vibrating) return;
  vibrating = false;
  Vibration.cancel();
}

export function isVibrating(): boolean {
  return vibrating;
}

// ---- Registro del token FCM en Supabase ----

/**
 * Obtiene el token FCM del dispositivo y lo guarda en la tabla `push_tokens`,
 * asociado al mesero logueado. El backend (Edge Function notify-llamado) usa
 * estos tokens para enviar el push por FCM.
 *
 * Idempotente: hace upsert por `token` (si el mismo dispositivo lo usa otro
 * mesero, se actualiza el mesero_id). Falla en silencio (no rompe el login).
 */
export async function savePushToken(meseroId: Id): Promise<void> {
  try {
    const token = await getFcmDeviceToken();
    if (!token) return;

    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          mesero_id: meseroId,
          token,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'token' },
      );

    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[notifications] No se pudo guardar el token push:', error.message);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[notifications] Error registrando token push:', err);
  }
}
