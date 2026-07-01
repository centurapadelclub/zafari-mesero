import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { displayIncomingCall, parseCallData } from './incomingCall';

/**
 * Tarea en segundo plano: recibe el push de FCM cuando la app está en segundo
 * plano o cerrada y, si trae datos de un llamado, dispara la llamada entrante
 * a pantalla completa (Esc2) vía notifee.
 *
 * ⚠️ Verificar en un dev build: la entrega de push en background depende del
 * SO/OEM. Si en tu build no se dispara, la alternativa robusta es usar
 * @react-native-firebase/messaging con setBackgroundMessageHandler llamando a
 * displayIncomingCall() (ver README, sección Escenario 2).
 */
export const BACKGROUND_PUSH_TASK = 'zafari-incoming-push';

TaskManager.defineTask(BACKGROUND_PUSH_TASK, async ({ data, error }) => {
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[backgroundTask] error:', error);
    return;
  }
  try {
    // El shape varía según la plataforma; buscamos el objeto de datos del push.
    const anyData = data as Record<string, any> | undefined;
    const payload =
      anyData?.notification?.data ?? anyData?.data ?? anyData?.body ?? anyData ?? null;
    const call = parseCallData(payload);
    if (call) {
      await displayIncomingCall(call);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[backgroundTask] fallo procesando push:', err);
  }
});

/** Registra la tarea de background para notificaciones remotas (Android). */
export async function registerBackgroundPushTask(): Promise<void> {
  try {
    await Notifications.registerTaskAsync(BACKGROUND_PUSH_TASK);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[backgroundTask] no se pudo registrar la tarea:', err);
  }
}
