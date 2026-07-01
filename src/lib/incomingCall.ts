import notifee, {
  AndroidCategory,
  AndroidImportance,
  Event,
  EventType,
} from '@notifee/react-native';
import { RootStackParamList } from '../types/db';
import { callChannelForPref, ensureChannels } from './notifications';

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

/** Muestra la notificación de llamada entrante con Full Screen Intent. */
export async function displayIncomingCall(call: CallData): Promise<void> {
  await ensureChannels();
  const channelId = await callChannelForPref();

  await notifee.displayNotification({
    title:
      call.kind === 'pedido' ? `Nuevo pedido — ${call.ubicacion}` : `Llamado — ${call.ubicacion}`,
    body: call.tipo ? `Tipo: ${call.tipo}` : 'Deslizá para atender',
    data: { kind: call.kind, id: call.id, ubicacion: call.ubicacion, tipo: call.tipo ?? '' },
    android: {
      channelId,
      importance: AndroidImportance.HIGH,
      category: AndroidCategory.CALL,
      // Lanza la app a pantalla completa sobre el bloqueo:
      fullScreenAction: { id: 'incoming-call' },
      pressAction: { id: 'incoming-call' },
      ongoing: true,
      autoCancel: false,
      timeoutAfter: 30000, // se descarta sola a los 30 s si nadie atiende
    },
  });
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
