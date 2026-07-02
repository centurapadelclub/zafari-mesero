import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  FeedItem,
  Id,
  LLAMADO_ATENDIDO,
  LLAMADO_PENDIENTE,
  Llamado,
  PEDIDO_ENTREGADO,
  PEDIDO_ESTADOS_ACTIVOS,
  PEDIDO_ESTADO_AL_ATENDER,
  Pedido,
} from '../types/db';

/** Une nombre + apellido del cliente en un solo string (lo que haya). */
function nombreCompleto(nombre?: string | null, apellido?: string | null): string | null {
  const full = [nombre, apellido].filter(Boolean).join(' ').trim();
  return full || null;
}

function llamadoToItem(r: Llamado): FeedItem {
  return {
    kind: 'llamado',
    id: r.id,
    ubicacion: r.ubicacion,
    estado: r.estado,
    tipo: r.tipo ?? null,
    cliente: nombreCompleto(r.nombre_cliente, r.apellido_cliente),
    telefono: r.telefono_cliente ?? null,
    created_at: r.created_at,
    atendido_at: r.atendido_at ?? null,
    mesero_id: r.mesero_id ?? null,
  };
}

function pedidoToItem(r: Pedido): FeedItem {
  return {
    kind: 'pedido',
    id: r.id,
    ubicacion: r.ubicacion,
    estado: r.estado,
    cliente: nombreCompleto(r.nombre_cliente, null),
    telefono: r.telefono_cliente ?? null,
    total: r.total ?? null,
    created_at: r.created_at,
    atendido_at: r.atendido_at ?? null,
    mesero_id: r.mesero_id ?? null,
  };
}

/** Inicio del día de hoy en hora local, como ISO (para filtrar el historial). */
function startOfTodayISO(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return start.toISOString();
}

export type ConnStatus = 'connecting' | 'connected' | 'error';

interface UseFeedResult {
  items: FeedItem[];
  loading: boolean;
  error: string | null;
  realtimeStatus: ConnStatus;
  refetch: () => Promise<void>;
  markAtendido: (item: FeedItem) => Promise<void>;
}

/**
 * Llamados y pedidos ACTIVOS de las zonas del mesero, en tiempo real.
 *  - llamados: estado = 'pendiente'
 *  - pedidos: estado IN ('pendiente', 'en_preparacion')  (aún no entregados)
 * Filtra por `ubicacion IN (nombres de zonas asignadas)`.
 */
export function useFeed(zonas: string[], meseroId: Id): UseFeedResult {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<ConnStatus>('connecting');

  const zonasRef = useRef(zonas);
  zonasRef.current = zonas;

  const fetchActivos = useCallback(async () => {
    const z = zonasRef.current;
    if (!z.length) {
      setItems([]);
      setLoading(false);
      return;
    }
    setError(null);

    const [llamadosRes, pedidosRes] = await Promise.all([
      supabase
        .from('llamados')
        .select('*')
        .eq('estado', LLAMADO_PENDIENTE)
        .in('ubicacion', z)
        .order('created_at', { ascending: true })
        .returns<Llamado[]>(),
      supabase
        .from('pedidos')
        .select('*')
        .in('estado', PEDIDO_ESTADOS_ACTIVOS)
        .in('ubicacion', z)
        .order('created_at', { ascending: true })
        .returns<Pedido[]>(),
    ]);

    if (llamadosRes.error || pedidosRes.error) {
      const msg = llamadosRes.error?.message ?? pedidosRes.error?.message ?? 'error desconocido';
      // eslint-disable-next-line no-console
      console.error('[useFeed] error en la consulta inicial:', llamadosRes.error, pedidosRes.error);
      setError(`No se pudieron cargar los llamados: ${msg}`);
      setLoading(false);
      return;
    }

    const merged: FeedItem[] = [
      ...(llamadosRes.data ?? []).map(llamadoToItem),
      ...(pedidosRes.data ?? []).map(pedidoToItem),
    ].sort((a, b) => a.created_at.localeCompare(b.created_at));

    setItems(merged);
    setLoading(false);
  }, []);

  // Carga inicial + suscripción realtime a ambas tablas.
  useEffect(() => {
    fetchActivos();

    const channel = supabase
      .channel('feed-mesero')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'llamados' }, () => {
        fetchActivos();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        fetchActivos();
      })
      .subscribe((status) => {
        // eslint-disable-next-line no-console
        console.log('[useFeed] realtime status:', status);
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')
          setRealtimeStatus('error');
        else setRealtimeStatus('connecting');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchActivos]);

  /**
   * Marca un item como atendido por el mesero actual.
   *  - llamado → estado 'atendido'
   *  - pedido  → estado 'entregado'
   * En ambos casos setea atendido_at y mesero_id (requiere la migración SQL).
   */
  const markAtendido = useCallback(
    async (item: FeedItem) => {
      // Optimista: lo sacamos de la lista enseguida.
      setItems((prev) => prev.filter((i) => !(i.kind === item.kind && i.id === item.id)));

      const table = item.kind === 'llamado' ? 'llamados' : 'pedidos';
      const nuevoEstado = item.kind === 'llamado' ? LLAMADO_ATENDIDO : PEDIDO_ESTADO_AL_ATENDER;
      const payload = {
        estado: nuevoEstado,
        atendido_at: new Date().toISOString(),
        mesero_id: meseroId,
      };

      const { error: updErr } = await supabase.from(table).update(payload).eq('id', item.id);

      if (updErr) {
        setError('No se pudo marcar como atendido. Reintentá.');
        await fetchActivos();
      }
    },
    [meseroId, fetchActivos],
  );

  return { items, loading, error, realtimeStatus, refetch: fetchActivos, markAtendido };
}

/**
 * Atendidos hoy, de las zonas del mesero (para el historial).
 *  - llamados: estado 'atendido', atendido_at >= hoy
 *  - pedidos:  estado 'entregado', atendido_at >= hoy
 * (Requiere la columna atendido_at en pedidos — ver migración SQL del README.)
 */
export function useHistorial(zonas: string[]) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistorial = useCallback(async () => {
    if (!zonas.length) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const desde = startOfTodayISO();

    const [llamadosRes, pedidosRes] = await Promise.all([
      supabase
        .from('llamados')
        .select('*')
        .eq('estado', LLAMADO_ATENDIDO)
        .in('ubicacion', zonas)
        .gte('atendido_at', desde)
        .order('atendido_at', { ascending: false })
        .returns<Llamado[]>(),
      supabase
        .from('pedidos')
        .select('*')
        .eq('estado', PEDIDO_ENTREGADO)
        .in('ubicacion', zonas)
        .gte('atendido_at', desde)
        .order('atendido_at', { ascending: false })
        .returns<Pedido[]>(),
    ]);

    const merged: FeedItem[] = [
      ...(llamadosRes.data ?? []).map(llamadoToItem),
      ...(pedidosRes.data ?? []).map(pedidoToItem),
    ].sort((a, b) =>
      (b.atendido_at ?? b.created_at).localeCompare(a.atendido_at ?? a.created_at),
    );

    // Resolver el nombre del mesero que atendió cada item (mesero_id -> nombre).
    const meseroIds = Array.from(
      new Set(merged.map((i) => i.mesero_id).filter((v) => v != null)),
    ) as (string | number)[];

    let nombrePorId: Record<string, string> = {};
    if (meseroIds.length) {
      const { data: meseros } = await supabase
        .from('meseros')
        .select('id, nombre')
        .in('id', meseroIds);
      nombrePorId = Object.fromEntries(
        (meseros ?? []).map((m: { id: string | number; nombre: string }) => [String(m.id), m.nombre]),
      );
    }

    const enriquecido = merged.map((i) => ({
      ...i,
      atendidoPor: i.mesero_id != null ? nombrePorId[String(i.mesero_id)] ?? null : null,
    }));

    setItems(enriquecido);
    setLoading(false);
  }, [zonas]);

  useEffect(() => {
    fetchHistorial();
  }, [fetchHistorial]);

  return { items, loading, refetch: fetchHistorial };
}
