import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { inicioDiaOperativo } from '../lib/fecha';
import {
  Id,
  PEDIDO_ENTREGADO,
  PEDIDO_EN_PREPARACION,
  PEDIDO_PENDIENTE,
  Pedido,
  PedidoItem,
  PEDIDO_ITEMS_TABLE,
} from '../types/db';

// --- Extracción defensiva de columnas del item (nombres reales pueden variar) ---
function pick(row: Record<string, unknown>, fields: string[]): unknown {
  for (const f of fields) if (row[f] != null) return row[f];
  return null;
}
function asStr(v: unknown): string | null {
  return v == null ? null : String(v);
}
function asNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function itemFromRow(r: Record<string, unknown>): PedidoItem {
  return {
    pedido_id: (pick(r, ['pedido_id', 'order_id']) ?? '') as Id,
    nombre: asStr(pick(r, ['nombre', 'name', 'producto', 'descripcion', 'titulo', 'item'])) ?? '(item)',
    cantidad: asNum(pick(r, ['cantidad', 'qty', 'cant', 'cantidad_pedida'])) ?? 1,
    precio: asNum(pick(r, ['precio', 'price', 'precio_unitario', 'subtotal'])),
    modificadores: asStr(pick(r, ['modificadores', 'modifiers', 'extras', 'opciones', 'adicionales'])),
    nota: asStr(pick(r, ['nota', 'notas', 'note', 'comentario', 'observacion', 'observaciones'])),
  };
}

const ACTIVOS = [PEDIDO_PENDIENTE, PEDIDO_EN_PREPARACION];

export function usePedidos(zonas: string[], meseroId: Id) {
  const [activos, setActivos] = useState<Pedido[]>([]);
  const [historial, setHistorial] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const zonasRef = useRef(zonas);
  zonasRef.current = zonas;

  const fetchActivos = useCallback(async () => {
    const z = zonasRef.current;
    if (!z.length) {
      setActivos([]);
      setLoading(false);
      return;
    }
    setError(null);
    const { data, error: e } = await supabase
      .from('pedidos')
      .select('*')
      .in('estado', ACTIVOS)
      .in('ubicacion', z)
      .order('created_at', { ascending: true })
      .returns<Pedido[]>();
    if (e) {
      // eslint-disable-next-line no-console
      console.error('[usePedidos] activos:', e.message);
      setError('No se pudieron cargar los pedidos.');
    } else {
      setActivos(data ?? []);
    }
    setLoading(false);
  }, []);

  const fetchHistorial = useCallback(async () => {
    const z = zonasRef.current;
    if (!z.length) {
      setHistorial([]);
      return;
    }
    const { data } = await supabase
      .from('pedidos')
      .select('*')
      .eq('estado', PEDIDO_ENTREGADO)
      .in('ubicacion', z)
      .gte('created_at', inicioDiaOperativo())
      .order('atendido_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .returns<Pedido[]>();
    setHistorial(data ?? []);
  }, []);

  useEffect(() => {
    fetchActivos();
    fetchHistorial();
    const ch = supabase
      .channel('pedidos-mesero')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        fetchActivos();
        fetchHistorial();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchActivos, fetchHistorial, zonas.join('|')]);

  /** Cambia el estado de un pedido. Al entregar setea atendido_at + mesero_id. */
  const setEstadoPedido = useCallback(
    async (pedidoId: Id, nuevoEstado: string) => {
      const payload: Record<string, unknown> = { estado: nuevoEstado };
      if (nuevoEstado === PEDIDO_ENTREGADO) {
        payload.atendido_at = new Date().toISOString();
        payload.mesero_id = meseroId;
      }
      // Optimista
      setActivos((prev) =>
        nuevoEstado === PEDIDO_ENTREGADO
          ? prev.filter((p) => p.id !== pedidoId)
          : prev.map((p) => (p.id === pedidoId ? { ...p, estado: nuevoEstado } : p)),
      );
      const { error: e } = await supabase.from('pedidos').update(payload).eq('id', pedidoId);
      if (e) {
        setError('No se pudo actualizar el pedido.');
        await fetchActivos();
        await fetchHistorial();
      }
    },
    [meseroId, fetchActivos, fetchHistorial],
  );

  /** Trae los items/detalle de un pedido (tabla asumida PEDIDO_ITEMS_TABLE). */
  const fetchPedidoItems = useCallback(async (pedidoId: Id): Promise<PedidoItem[]> => {
    const { data, error: e } = await supabase
      .from(PEDIDO_ITEMS_TABLE)
      .select('*')
      .eq('pedido_id', pedidoId)
      .returns<Record<string, unknown>[]>();
    if (e) {
      // eslint-disable-next-line no-console
      console.error('[usePedidos] items:', e.message);
      return [];
    }
    return (data ?? []).map(itemFromRow);
  }, []);

  /** Trae los items de varios pedidos de una sola vez, agrupados por pedido_id. */
  const fetchItemsForPedidos = useCallback(
    async (ids: Id[]): Promise<Record<string, PedidoItem[]>> => {
      if (!ids.length) return {};
      const { data, error: e } = await supabase
        .from(PEDIDO_ITEMS_TABLE)
        .select('*')
        .in('pedido_id', ids)
        .returns<Record<string, unknown>[]>();
      if (e) {
        // eslint-disable-next-line no-console
        console.error('[usePedidos] items batch:', e.message);
        return {};
      }
      const map: Record<string, PedidoItem[]> = {};
      for (const row of data ?? []) {
        const it = itemFromRow(row);
        const key = String(it.pedido_id);
        (map[key] ??= []).push(it);
      }
      return map;
    },
    [],
  );

  return {
    activos,
    historial,
    loading,
    error,
    refetch: fetchActivos,
    setEstadoPedido,
    fetchPedidoItems,
    fetchItemsForPedidos,
  };
}
