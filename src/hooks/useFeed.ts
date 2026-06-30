import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ESTADO_ATENDIDO, ESTADO_PENDIENTE, FeedItem, Llamado, Pedido } from '../types/db';

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
    atendido_at: null, // la tabla pedidos no tiene atendido_at
  };
}

/** Inicio del día de hoy en hora local, como ISO (para filtrar el historial). */
function startOfTodayISO(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return start.toISOString();
}

interface UseFeedResult {
  items: FeedItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  markAtendido: (item: FeedItem) => Promise<void>;
}

/**
 * Llamados y pedidos PENDIENTES de las zonas del mesero, en tiempo real.
 * Filtra por `ubicacion IN (nombres de zonas asignadas)`.
 */
export function useFeed(zonas: string[], _meseroId: unknown): UseFeedResult {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const zonasRef = useRef(zonas);
  zonasRef.current = zonas;

  const fetchPendientes = useCallback(async () => {
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
        .eq('estado', ESTADO_PENDIENTE)
        .in('ubicacion', z)
        .order('created_at', { ascending: true })
        .returns<Llamado[]>(),
      supabase
        .from('pedidos')
        .select('*')
        .eq('estado', ESTADO_PENDIENTE)
        .in('ubicacion', z)
        .order('created_at', { ascending: true })
        .returns<Pedido[]>(),
    ]);

    if (llamadosRes.error || pedidosRes.error) {
      setError('No se pudieron cargar los llamados.');
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
    fetchPendientes();

    const channel = supabase
      .channel('feed-mesero')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'llamados' }, () => {
        fetchPendientes();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        fetchPendientes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPendientes]);

  /** Marca un llamado/pedido como atendido. */
  const markAtendido = useCallback(
    async (item: FeedItem) => {
      // Optimista: lo sacamos de la lista enseguida.
      setItems((prev) => prev.filter((i) => !(i.kind === item.kind && i.id === item.id)));

      // El payload difiere por tabla: pedidos no tiene atendido_at.
      const table = item.kind === 'llamado' ? 'llamados' : 'pedidos';
      const payload =
        item.kind === 'llamado'
          ? { estado: ESTADO_ATENDIDO, atendido_at: new Date().toISOString() }
          : { estado: ESTADO_ATENDIDO };

      const { error: updErr } = await supabase.from(table).update(payload).eq('id', item.id);

      if (updErr) {
        setError('No se pudo marcar como atendido. Reintentá.');
        await fetchPendientes();
      }
    },
    [fetchPendientes],
  );

  return { items, loading, error, refetch: fetchPendientes, markAtendido };
}

/**
 * Atendidos hoy, de las zonas del mesero (para el historial).
 *  - llamados: filtra por atendido_at >= hoy.
 *  - pedidos: no tienen atendido_at, así que se filtran por created_at >= hoy.
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
        .eq('estado', ESTADO_ATENDIDO)
        .in('ubicacion', zonas)
        .gte('atendido_at', desde)
        .order('atendido_at', { ascending: false })
        .returns<Llamado[]>(),
      supabase
        .from('pedidos')
        .select('*')
        .eq('estado', ESTADO_ATENDIDO)
        .in('ubicacion', zonas)
        .gte('created_at', desde)
        .order('created_at', { ascending: false })
        .returns<Pedido[]>(),
    ]);

    const merged: FeedItem[] = [
      ...(llamadosRes.data ?? []).map(llamadoToItem),
      ...(pedidosRes.data ?? []).map(pedidoToItem),
    ].sort((a, b) =>
      (b.atendido_at ?? b.created_at).localeCompare(a.atendido_at ?? a.created_at),
    );

    setItems(merged);
    setLoading(false);
  }, [zonas]);

  useEffect(() => {
    fetchHistorial();
  }, [fetchHistorial]);

  return { items, loading, refetch: fetchHistorial };
}
