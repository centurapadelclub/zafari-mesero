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
  PedidoItemModificador,
  PEDIDO_ITEMS_TABLE,
  PEDIDO_ITEM_MODIFICADORES_TABLE,
} from '../types/db';

function asNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Fila de pedido_items -> PedidoItem (sin modificadores todavía). */
function itemBaseFromRow(r: Record<string, unknown>): PedidoItem {
  return {
    id: r.id as Id,
    pedido_id: r.pedido_id as Id,
    nombre: r.nombre_producto != null ? String(r.nombre_producto) : '(item)',
    cantidad: asNum(r.cantidad) ?? 1,
    precioUnitario: asNum(r.precio_unitario),
    subtotal: asNum(r.subtotal),
    notas: r.notas != null ? String(r.notas) : null,
    modificadores: [],
  };
}

/** Adjunta a cada item su lista de modificadores (pedido_item_modificadores). */
async function attachModificadores(items: PedidoItem[]): Promise<void> {
  const itemIds = items.map((i) => i.id).filter((v) => v != null) as Id[];
  if (!itemIds.length) return;
  const { data, error } = await supabase
    .from(PEDIDO_ITEM_MODIFICADORES_TABLE)
    .select('*')
    .in('pedido_item_id', itemIds)
    .returns<Record<string, unknown>[]>();
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[usePedidos] modificadores:', error.message);
    return;
  }
  const byItem: Record<string, PedidoItemModificador[]> = {};
  for (const m of data ?? []) {
    const key = String(m.pedido_item_id);
    (byItem[key] ??= []).push({
      nombre_modificador: m.nombre_modificador != null ? String(m.nombre_modificador) : null,
      nombre_opcion: m.nombre_opcion != null ? String(m.nombre_opcion) : '',
      precio_extra: asNum(m.precio_extra),
    });
  }
  for (const it of items) {
    if (it.id != null) it.modificadores = byItem[String(it.id)] ?? [];
  }
}

const ACTIVOS = [PEDIDO_PENDIENTE, PEDIDO_EN_PREPARACION];

/** Resuelve mesero_id -> nombre para una lista de filas de pedido. */
async function resolverNombresMeseros(rows: Pedido[]): Promise<Record<string, string>> {
  const ids = Array.from(
    new Set(rows.map((r) => r.mesero_id).filter((v) => v != null)),
  ) as Id[];
  if (!ids.length) return {};
  const { data } = await supabase.from('meseros').select('id, nombre').in('id', ids);
  return Object.fromEntries(
    (data ?? []).map((m: { id: Id; nombre: string }) => [String(m.id), m.nombre]),
  );
}

export function usePedidos(zonas: string[], meseroId: Id) {
  const [activos, setActivos] = useState<Pedido[]>([]);
  const [historial, setHistorial] = useState<Pedido[]>([]);
  const [nombrePorMesero, setNombrePorMesero] = useState<Record<string, string>>({});
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
      const rows = data ?? [];
      setActivos(rows);
      const nombres = await resolverNombresMeseros(rows);
      setNombrePorMesero((prev) => ({ ...prev, ...nombres }));
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
    const CH = 'pedidos-mesero';
    // Evitar doble suscripción al MISMO topic: si quedó un canal previo sin
    // limpiar (p. ej. al volver del IncomingCall), reusar el nombre crashea con
    // "cannot add postgres_changes callbacks for realtime:pedidos-mesero after
    // subscribe()". Removemos cualquier canal con ese topic antes de crear uno.
    supabase.getChannels().forEach((c) => {
      if (c.topic === `realtime:${CH}` || c.topic === CH) supabase.removeChannel(c);
    });
    const ch = supabase
      .channel(CH)
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
      // Registramos quién lo atiende tanto al ponerlo "en preparación" (para
      // mostrar "En preparación por X") como al entregarlo.
      if (nuevoEstado === PEDIDO_EN_PREPARACION || nuevoEstado === PEDIDO_ENTREGADO) {
        payload.mesero_id = meseroId;
      }
      if (nuevoEstado === PEDIDO_ENTREGADO) {
        payload.atendido_at = new Date().toISOString();
      }
      // Optimista
      setActivos((prev) =>
        nuevoEstado === PEDIDO_ENTREGADO
          ? prev.filter((p) => p.id !== pedidoId)
          : prev.map((p) =>
              p.id === pedidoId ? { ...p, estado: nuevoEstado, mesero_id: meseroId } : p,
            ),
      );

      // Usamos .select() para SABER si el UPDATE realmente tocó la fila. Un
      // UPDATE bloqueado por RLS no devuelve error pero afecta 0 filas: sin esto
      // el pedido "desaparecía" y luego un refetch lo traía de vuelta como activo.
      const primero = await supabase
        .from('pedidos')
        .update(payload)
        .eq('id', pedidoId)
        .select('id');

      let e = primero.error;
      let filas = primero.data?.length ?? 0;

      // Fallback: si el payload completo falla (p. ej. faltan las columnas
      // atendido_at / mesero_id en la tabla), reintentamos solo con `estado`
      // para que al menos el cambio de estado persista.
      if (e && (nuevoEstado === PEDIDO_ENTREGADO || nuevoEstado === PEDIDO_EN_PREPARACION)) {
        // eslint-disable-next-line no-console
        console.warn('[usePedidos] update completo falló, reintento solo estado:', e.message);
        const retry = await supabase
          .from('pedidos')
          .update({ estado: nuevoEstado })
          .eq('id', pedidoId)
          .select('id');
        e = retry.error;
        filas = retry.data?.length ?? 0;
      }

      if (e) {
        // eslint-disable-next-line no-console
        console.error('[usePedidos] setEstado error:', e.message);
        setError(`No se pudo actualizar el pedido: ${e.message}`);
        await fetchActivos();
        await fetchHistorial();
      } else if (filas === 0) {
        // Sin error pero 0 filas => la política RLS de UPDATE bloqueó el cambio.
        setError(
          'La base de datos rechazó el cambio de estado (permisos RLS de UPDATE en "pedidos"). ' +
            'Agregá una policy de UPDATE para el rol anon.',
        );
        await fetchActivos();
        await fetchHistorial();
      } else {
        // Éxito real: refrescamos historial para que aparezca ahí al entregar.
        setError(null);
        if (nuevoEstado === PEDIDO_ENTREGADO) await fetchHistorial();
      }
    },
    [meseroId, fetchActivos, fetchHistorial],
  );

  /** Trae los items (con modificadores) de un pedido. */
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
    const items = (data ?? []).map(itemBaseFromRow);
    await attachModificadores(items);
    return items;
  }, []);

  /** Trae los items (con modificadores) de varios pedidos, agrupados por pedido_id. */
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
      const items = (data ?? []).map(itemBaseFromRow);
      await attachModificadores(items);
      const map: Record<string, PedidoItem[]> = {};
      for (const it of items) {
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
    nombrePorMesero,
    loading,
    error,
    refetch: fetchActivos,
    setEstadoPedido,
    fetchPedidoItems,
    fetchItemsForPedidos,
  };
}
