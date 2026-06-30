import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { FeedItem, Llamado, Pedido } from '../types/db';

/**
 * Mapea filas de `llamados` y `pedidos` a un FeedItem unificado.
 * Centraliza los nombres de columna: si tu esquema difiere, ajustá acá.
 */
function llamadoToItem(r: Llamado): FeedItem {
  return {
    kind: 'llamado',
    id: r.id,
    mesa: r.mesa,
    zona: r.zona,
    estado: r.estado,
    descripcion: null,
    created_at: r.created_at,
    atendido_at: r.atendido_at ?? null,
  };
}

function pedidoToItem(r: Pedido): FeedItem {
  return {
    kind: 'pedido',
    id: r.id,
    mesa: r.mesa,
    zona: r.zona,
    estado: r.estado,
    descripcion: r.descripcion ?? null,
    created_at: r.created_at,
    atendido_at: r.atendido_at ?? null,
  };
}

const tableForKind = (kind: FeedItem['kind']) => (kind === 'llamado' ? 'llamados' : 'pedidos');

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
 * Se suscribe a cambios (insert/update/delete) en ambas tablas vía Supabase
 * Realtime y refresca la lista automáticamente.
 */
export function useFeed(zonas: string[], meseroId: string): UseFeedResult {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mantener la última versión de zonas accesible dentro de callbacks estables.
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
        .eq('estado', 'pendiente')
        .in('zona', z)
        .order('created_at', { ascending: true })
        .returns<Llamado[]>(),
      supabase
        .from('pedidos')
        .select('*')
        .eq('estado', 'pendiente')
        .in('zona', z)
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

  // Carga inicial + suscripción realtime.
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

  /** Marca un llamado/pedido como atendido por el mesero actual. */
  const markAtendido = useCallback(
    async (item: FeedItem) => {
      // Actualización optimista: lo sacamos de la lista enseguida.
      setItems((prev) => prev.filter((i) => !(i.kind === item.kind && i.id === item.id)));

      const { error: updErr } = await supabase
        .from(tableForKind(item.kind))
        .update({
          estado: 'atendido',
          atendido_at: new Date().toISOString(),
          mesero_id: meseroId,
        })
        .eq('id', item.id);

      if (updErr) {
        // Si falla, recargamos para volver al estado real.
        setError('No se pudo marcar como atendido. Reintentá.');
        await fetchPendientes();
      }
    },
    [meseroId, fetchPendientes],
  );

  return { items, loading, error, refetch: fetchPendientes, markAtendido };
}

/**
 * Llamados y pedidos YA ATENDIDOS hoy, de las zonas del mesero.
 * Para el historial del día (no necesita realtime; se refresca al entrar).
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
        .eq('estado', 'atendido')
        .in('zona', zonas)
        .gte('atendido_at', desde)
        .order('atendido_at', { ascending: false })
        .returns<Llamado[]>(),
      supabase
        .from('pedidos')
        .select('*')
        .eq('estado', 'atendido')
        .in('zona', zonas)
        .gte('atendido_at', desde)
        .order('atendido_at', { ascending: false })
        .returns<Pedido[]>(),
    ]);

    const merged: FeedItem[] = [
      ...(llamadosRes.data ?? []).map(llamadoToItem),
      ...(pedidosRes.data ?? []).map(pedidoToItem),
    ].sort((a, b) => (b.atendido_at ?? '').localeCompare(a.atendido_at ?? ''));

    setItems(merged);
    setLoading(false);
  }, [zonas]);

  useEffect(() => {
    fetchHistorial();
  }, [fetchHistorial]);

  return { items, loading, refetch: fetchHistorial };
}
