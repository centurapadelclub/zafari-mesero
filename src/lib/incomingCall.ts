import notifee, {
  AndroidCategory,
  AndroidImportance,
  AlarmType,
  Event,
  EventType,
  TriggerType,
  TimestampTrigger,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../types/db';
import { CHANNEL_HEADSUP, callChannelForPref, ensureChannels } from './notifications';

/**
 * Escenario 2 — construcción y ruteo de la "llamada entrante" (Full Screen Intent).
 *
 * displayIncomingCall() arma la notificación con `fullScreenAction`, que en
 * Android hace que — si la pantalla está bloqueada/apagada — se abra la app a
 * pantalla completa (nuestra IncomingCallScreen). Si el celular está en uso,
 * Android la muestra como heads-up (Esc3) automáticamente.
 */

export interface CallData {
  kind: 'llamado' | 'pedido';
  id: string;
  ubicacion: string;
  tipo?: string | null;
}

/** Extrae los datos de la llamada desde el `data` de una notificación (o null). */
export function parseCallData(data?: Record<string, unknown> | null): CallData | null {
  if (!data) return null;
  const ubicacion = data.ubicacion != null ? String(data.ubicacion) : '';
  if (!ubicacion) return null;
  const kind = String(data.kind) === 'pedido' ? 'pedido' : 'llamado';
  return {
    kind,
    id: data.id != null ? String(data.id) : '',
    ubicacion,
    tipo: data.tipo != null ? String(data.tipo) : null,
  };
}

/** Arma el objeto de notificación de "llamada entrante" (reutilizado por el
 *  display inmediato y por el snooze programado). */
async function buildIncomingCallNotification(call: CallData) {
  const channelId = await callChannelForPref();
  return {
    title:
      call.kind === 'pedido' ? `Nuevo pedido — ${call.ubicacion}` : `Llamado — ${call.ubicacion}`,
    body: call.tipo ? `Tipo: ${call.tipo}` : 'Desliza para atender',
    data: { kind: call.kind, id: call.id, ubicacion: call.ubicacion, tipo: call.tipo ?? '' },
    android: {
      channelId,
      importance: AndroidImportance.HIGH,
      category: AndroidCategory.CALL,
      // Lanza la app a pantalla completa sobre el bloqueo:
      fullScreenAction: { id: 'incoming-call', launchActivity: 'default' },
      // launchActivity 'default' es CLAVE: sin él, tocar el banner entrega el
      // evento PRESS pero NO trae la app al frente (bug del warm start
      // desbloqueado). Con 'default', Android relanza la MainActivity (trae la
      // task al frente) al tocar, además de entregar el PRESS que navega.
      pressAction: { id: 'incoming-call', launchActivity: 'default' },
      ongoing: true,
      autoCancel: false,
      timeoutAfter: 30000, // se descarta sola a los 30 s si nadie atiende
    },
  };
}

/** Muestra la notificación de llamada entrante con Full Screen Intent. */
export async function displayIncomingCall(call: CallData): Promise<void> {
  await ensureChannels();
  await notifee.displayNotification(await buildIncomingCallNotification(call));
}

/**
 * Snooze: programa una notificación IDÉNTICA a la llamada entrante para dentro
 * de `ms` (por defecto 30 s). notifee la dispara de forma nativa aunque la app
 * esté cerrada (TimestampTrigger con alarmManager), reabriendo la misma pantalla
 * a pantalla completa si el mesero no atendió.
 */
export async function scheduleSnooze(call: CallData, ms = 30000): Promise<void> {
  await ensureChannels();
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: Date.now() + ms,
    // Alarma EXACTA aunque el sistema esté en Doze (requiere el permiso
    // SCHEDULE_EXACT_ALARM declarado en app.config.ts).
    alarmManager: { type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE },
  };
  await notifee.createTriggerNotification(await buildIncomingCallNotification(call), trigger);
}

/**
 * Esc3: muestra un heads-up (banner) cuando el push llega con la app en uso.
 * Vibración corta (la del canal), sin sonido, auto-dismiss ~5 s.
 */
export async function displayHeadsUp(call: CallData): Promise<void> {
  await ensureChannels();
  await notifee.displayNotification({
    title:
      call.kind === 'pedido' ? `Nuevo pedido — ${call.ubicacion}` : `Llamado — ${call.ubicacion}`,
    body: call.tipo ? `Tipo: ${call.tipo}` : 'Toca para ver',
    data: { kind: call.kind, id: call.id, ubicacion: call.ubicacion, tipo: call.tipo ?? '' },
    android: {
      channelId: CHANNEL_HEADSUP,
      importance: AndroidImportance.HIGH,
      pressAction: { id: 'incoming-call' },
      timeoutAfter: 5000, // el banner se descarta solo a los ~5 s
      autoCancel: true,
    },
  });
}

/**
 * Persistencia de la "llamada pendiente" del cold start.
 *
 * En arranque en frío, el push data-only REVIVE la app vía
 * setBackgroundMessageHandler SIN que el usuario toque nada. Por eso
 * notifee.getInitialNotification() devuelve null (solo trae la notif con TAP) y
 * onBackgroundEvent llega como DELIVERED, no PRESS → no hay forma de saber a qué
 * llamada arrancar. El ÚNICO punto donde el call existe con certeza es el
 * background handler cuando llega el push: ahí lo guardamos y al montar lo leemos.
 */
const PENDING_CALL_KEY = 'pending_incoming_call';
const PENDING_CALL_MAX_AGE_MS = 30000;

/** Guarda el call que llegó por push (con timestamp) para leerlo al montar. */
export async function savePendingIncomingCall(call: CallData): Promise<void> {
  await AsyncStorage.setItem(
    PENDING_CALL_KEY,
    JSON.stringify({ ...call, ts: Date.now() }),
  );
}

/** Lee y BORRA la llamada pendiente. Devuelve la CallData solo si es reciente
 *  (< 30 s); si es vieja o no hay, devuelve null. Borra siempre tras leer para
 *  no reabrir en el siguiente arranque normal. */
export async function takePendingIncomingCall(): Promise<CallData | null> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(PENDING_CALL_KEY);
    await AsyncStorage.removeItem(PENDING_CALL_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const ts = typeof obj.ts === 'number' ? obj.ts : 0;
    if (Date.now() - ts > PENDING_CALL_MAX_AGE_MS) return null; // rancio
    return parseCallData(obj);
  } catch {
    return null;
  }
}

/** Borra la llamada pendiente (por si acaso, al cerrar la pantalla). */
export async function clearPendingIncomingCall(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_CALL_KEY);
  } catch {
    // ignorar
  }
}

/** Params de navegación a IncomingCall a partir de una CallData. */
export function callToRoute(call: CallData): RootStackParamList['IncomingCall'] {
  return { kind: call.kind, id: call.id, ubicacion: call.ubicacion, tipo: call.tipo };
}

/**
 * Maneja un evento de notifee y, si corresponde a una llamada, navega.
 * `navigate` viene del navigationRef (ver navigation/navigationRef.ts).
 */
export function handleNotifeeEvent(
  event: Event,
  navigate: (route: RootStackParamList['IncomingCall']) => void,
): void {
  const { type, detail } = event;
  if (type === EventType.PRESS || type === EventType.DELIVERED) {
    const call = parseCallData(detail.notification?.data as Record<string, unknown> | undefined);
    if (call) navigate(callToRoute(call));
  }
}
