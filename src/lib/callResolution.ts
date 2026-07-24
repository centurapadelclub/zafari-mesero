import { FeedKind } from '../types/db';

/**
 * Bus mínimo para avisar que una llamada/pedido fue RESUELTA (otro mesero la
 * atendió: dejó de estar 'pendiente'). Lo emite el watcher de Realtime
 * (useResolvedCallWatcher) y lo escucha la IncomingCallScreen para cerrarse si
 * está mostrando ese mismo id.
 */
type Listener = (kind: FeedKind, id: string | number) => void;

const listeners = new Set<Listener>();

export function emitCallResolved(kind: FeedKind, id: string | number): void {
  listeners.forEach((l) => {
    try {
      l(kind, id);
    } catch {
      // un listener no debe romper a los demás
    }
  });
}

export function subscribeCallResolved(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
