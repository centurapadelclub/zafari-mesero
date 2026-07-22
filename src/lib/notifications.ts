import { Platform, Vibration } from 'react-native';
import * as Device from 'expo-device';
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AndroidForegroundServiceType,
  AuthorizationStatus,
} from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import { supabase } from './supabase';
import { Id } from '../types/db';
import { getSoundPref } from './preferences';
import { setPushDiag } from './pushDiag';

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
// Sufijo -v3: los canales de Android son inmutables una vez creados. Al cambiar
// el id, Android crea canales NUEVOS con el vibrationPattern nuevo ([0,3000])
// sin necesidad de reinstalar la app.
export const CHANNEL_HEADSUP = 'llamados-v3'; // Esc3
export const CHANNEL_CALL_SOUND = 'llamado-call-sound-v3'; // Esc2 con sonido
export const CHANNEL_CALL_SILENT = 'llamado-call-silent-v3'; // Esc2 solo vibración
// Canal del Foreground Service: baja importancia, discreto, sin sonido/vibración.
export const CHANNEL_FGS = 'zafari-fgs'; // notificación persistente "app activa"
const FGS_NOTIFICATION_ID = 'zafari-foreground-service';

// ---- Patrones de vibración ----
// Esc3: corto, una sola vez ("brr brr").
const PATTERN_SHORT = [0, 250, 150, 250];
// Esc2: tipo llamada telefónica, fuerte-suave, repetido (se corta a los 10 s).
const PATTERN_CALL = [0, 800, 300, 500, 300];
const CALL_VIBRATION_MAX_MS = 10000;
// Patrón del CANAL de notifee: 0 ms de pausa + 3000 ms de vibración fuerte.
// notifee exige valores POSITIVOS en vibrationPattern (el 0 rompe createChannel:
// "expected an array containing an even number of positive values"). Por eso el
// patrón del canal arranca en 500 (espera) + 3000 (vibración), no en 0.
const PATTERN_CHANNEL = [500, 3000];

/**
 * Crea/actualiza los canales de notificación (todo con notifee). Idempotente.
 * En notifee, omitir `sound` = SIN sonido; `sound: 'default'` = sonido del sistema.
 */
export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    // Esc3: heads-up con vibración corta y SIN sonido (sin campo `sound`).
    await notifee.createChannel({
      id: CHANNEL_HEADSUP,
      name: 'Llamados (en uso)',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      vibration: true,
      vibrationPattern: PATTERN_CHANNEL,
    });

    // Esc2: canales para la llamada entrante (Full Screen Intent lo arma notifee).
    await notifee.createChannel({
      id: CHANNEL_CALL_SOUND,
      name: 'Llamada entrante (sonido)',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'default',
      vibration: true,
      vibrationPattern: PATTERN_CHANNEL,
      bypassDnd: true,
    });
    await notifee.createChannel({
      id: CHANNEL_CALL_SILENT,
      name: 'Llamada entrante (solo vibración)',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      vibration: true,
      vibrationPattern: PATTERN_CHANNEL,
      bypassDnd: true,
    });

    // Canal del Foreground Service: baja importancia, discreto (sin sonido ni
    // vibración) para la notificación persistente "Zafari Mesero activo".
    await notifee.createChannel({
      id: CHANNEL_FGS,
      name: 'Servicio en segundo plano',
      importance: AndroidImportance.LOW,
      visibility: AndroidVisibility.PUBLIC,
      vibration: false,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notifications] no se pudieron crear los canales (notifee):', err);
  }
}

/**
 * Flag del Foreground Service. Manifest verificado (el service de notifee tiene
 * android:foregroundServiceType="connectedDevice"), así que queda ACTIVO. Se
 * arranca con delay + try-catch robusto para dar margen a que notifee inicialice.
 */
const FGS_ENABLED = false;

/**
 * Arranca el Foreground Service (estilo WhatsApp): mantiene el proceso vivo para
 * que el setBackgroundMessageHandler procese siempre los push FCM data-only y
 * pueda mostrar la pantalla de llamada completa. Muestra una notificación
 * persistente discreta en el canal de baja importancia. Idempotente.
 */
export async function startForegroundService(): Promise<void> {
  if (Platform.OS !== 'android' || !FGS_ENABLED) return;

  // El canal se crea aparte para que un fallo acá no impida intentar el display.
  try {
    await ensureChannels();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notifications] ensureChannels (fgs) falló:', err);
  }

  // Envoltura robusta del display del FGS: cualquier error (incluido el arranque
  // del service nativo) queda logueado y NO tumba el flujo de login.
  try {
    await notifee.displayNotification({
      id: FGS_NOTIFICATION_ID,
      title: 'Zafari Mesero activo',
      body: 'Escuchando llamados y pedidos',
      android: {
        channelId: CHANNEL_FGS,
        asForegroundService: true,
        ongoing: true,
        smallIcon: 'ic_launcher',
        importance: AndroidImportance.LOW,
        // Android 14+: tipo de servicio (coincide con el permiso declarado).
        foregroundServiceTypes: [
          AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE,
        ],
        pressAction: { id: 'default' },
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notifications] no se pudo iniciar el foreground service:', err);
  }
}

/** Detiene el Foreground Service (al desloguear). */
export async function stopForegroundService(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await notifee.stopForegroundService();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notifications] no se pudo detener el foreground service:', err);
  }
}

/**
 * Abre los ajustes del "administrador de energía"/optimización de batería del
 * fabricante, para que el mesero excluya la app y no la mate en segundo plano.
 */
export async function openPowerManagerSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await notifee.openPowerManagerSettings();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[notifications] openPowerManagerSettings falló:', err);
  }
}

/** El canal de la llamada entrante según la preferencia de sonido guardada. */
export async function callChannelForPref(): Promise<string> {
  const pref = await getSoundPref();
  return pref === 'vibration_only' ? CHANNEL_CALL_SILENT : CHANNEL_CALL_SOUND;
}

// ---- Permisos (vía notifee) ----
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    await ensureChannels();
    // En Android 13+ dispara el prompt de POST_NOTIFICATIONS; en versiones
    // anteriores devuelve AUTHORIZED directamente.
    const settings = await notifee.requestPermission();
    return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notifications] requestPermission falló (notifee):', err);
    return false;
  }
}

/**
 * Snooze: abre el ajuste de Android "Permitir alarmas y recordatorios"
 * (SCHEDULE_EXACT_ALARM). En Android 12+ este permiso NO tiene diálogo runtime:
 * hay que mandar al usuario a la pantalla de ajustes. Sin él, la notificación de
 * snooze programada con alarma EXACTA no dispara a los 30 s.
 */
export async function requestExactAlarmPermission(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await notifee.openAlarmPermissionSettings();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[notifications] openAlarmPermissionSettings falló:', err);
  }
}

// ---- Token FCM (vía @react-native-firebase/messaging) ----
// Consolidamos toda la mensajería FCM en RNFirebase (token + foreground +
// background) para el manejo confiable con la app cerrada (ver index.ts).
export async function getFcmDeviceToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const granted = await requestNotificationPermissions();
  if (!granted) return null;
  try {
    return await messaging().getToken();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[notifications] No se pudo obtener el token FCM:', err);
    return null;
  }
}

/**
 * Devuelve el token FCM actual SIN volver a pedir permisos (para mostrarlo en el
 * panel como diagnóstico). Null en emulador o si no hay token.
 */
export async function peekFcmToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    return await messaging().getToken();
  } catch {
    return null;
  }
}

/**
 * Proyecto/sender de FCM con el que está registrada la app (según
 * google-services.json embebido en el build). DEBE coincidir con el proyecto del
 * service account que usa la Edge Function para enviar por FCM v1; si no, los
 * envíos dan UNREGISTERED aunque el token sea válido.
 */
export function fcmProjectInfo(): string {
  try {
    const o = messaging().app.options as { projectId?: string; messagingSenderId?: string };
    return `proyecto=${o.projectId ?? '?'} sender=${o.messagingSenderId ?? '?'}`;
  } catch {
    return 'proyecto=? sender=?';
  }
}

/** Esc1: guarda el token (upsert por token) al loguear. */
export async function savePushToken(meseroId: Id): Promise<void> {
  try {
    const token = await getFcmDeviceToken();
    if (!token) {
      setPushDiag(`push_tokens: sin token FCM (mesero_id=${meseroId})\n${fcmProjectInfo()}`);
      return;
    }
    const tok10 = token.slice(0, 10);
    // .select() para saber cuántas filas escribió realmente (y forzar el error
    // de RLS/tipo si lo hay). Mostramos el resultado exacto en el panel.
    const { data, error } = await supabase
      .from('push_tokens')
      .upsert(
        { mesero_id: meseroId, token, platform: Platform.OS, updated_at: new Date().toISOString() },
        { onConflict: 'token' },
      )
      .select('id');
    if (error) {
      console.warn('[notifications] No se pudo guardar el token:', error.message);
      setPushDiag(
        `push_tokens ✗ ERROR\nmesero_id=${meseroId}\ntoken=${tok10}…\nmsg: ${error.message}` +
          (error.details ? `\ndetails: ${error.details}` : '') +
          (error.hint ? `\nhint: ${error.hint}` : '') +
          (error.code ? `\ncode: ${error.code}` : '') +
          `\n${fcmProjectInfo()}`,
      );
    } else {
      setPushDiag(
        `push_tokens ✓ OK\nmesero_id=${meseroId}\ntoken=${tok10}…\nfilas=${data?.length ?? 0}` +
          `\n${fcmProjectInfo()}`,
      );
    }
  } catch (err) {
    console.warn('[notifications] Error registrando token:', err);
    setPushDiag(`push_tokens ✗ EXCEPCIÓN (mesero_id=${meseroId})\n${String(err)}`);
  }
}

/**
 * Esc1: elimina el token de este dispositivo al desloguear, para que NO le
 * lleguen más notificaciones. Borra por token (este device); si no se puede
 * obtener el token, borra todos los del mesero como fallback.
 */
export async function deletePushToken(meseroId: Id): Promise<void> {
  try {
    // peekFcmToken() NO pide permisos (a diferencia de getFcmDeviceToken); además
    // le ponemos un timeout corto: en gama baja getToken() puede tardar mucho por
    // la llamada de red a Firebase, y no queremos bloquear el logout. Si no
    // resuelve a tiempo o es null, caemos al fallback: borrar por mesero_id.
    const token = await Promise.race<string | null>([
      peekFcmToken(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);
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
