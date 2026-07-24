import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { cancelCallNotification, clearPendingIncomingCallIfMatches } from '../lib/incomingCall';
import { emitCallResolved } from '../lib/callResolution';
import { FeedKind, LLAMADO_PENDIENTE, PEDIDO_PENDIENTE } from '../types/db';

/**
 * Escucha UPDATE de `llamados` y `pedidos` en Realtime. Cuando una fila deja de
 * estar 'pendiente' (otro mesero la atendió / la puso en preparación / la
 * entregó), en TODOS los teléfonos:
 *   - cancela la notificación de esa llamada (notifee),
 *   - limpia el pending_incoming_call si corresponde a ese id,
 *   - emite callResolved para que la IncomingCallScreen se cierre si la muestra.
 *
 * Es un canal PROPIO (independiente de los de PanelScreen), así funciona aunque
 * el panel no esté montado (p. ej. arranque en frío directo en IncomingCall).
 * Solo se suscribe cuando hay sesión (`active`).
 */
export function useResolvedCallWatcher(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    const CH = 'resolved-calls-watcher';
    // Evitar doble suscripción al mismo topic (mismo patrón que usePedidos).
    supabase.getChannels().forEach((c) => {
      if (c.topic === `realtime:${CH}` || c.topic === CH) supabase.removeChannel(c);
    });

    const handle = (kind: FeedKind, row: Record<string, unknown> | undefined) => {
      const estado = String(row?.estado ?? '');
      const pendiente = kind === 'llamado' ? LLAMADO_PENDIENTE : PEDIDO_PENDIENTE;
      if (!estado || estado === pendiente) return; // sigue pendiente: nada que hacer
      const id = row?.id as string | number | undefined;
      if (id == null) return;
      cancelCallNotification(kind, id);
      clearPendingIncomingCallIfMatches(kind, id);
      emitCallResolved(kind, id);
    };

    const ch = supabase
      .channel(CH)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'llamados' },
        (p) => handle('llamado', p.new as Record<string, unknown>),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos' },
        (p) => handle('pedido', p.new as Record<string, unknown>),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [active]);
}
