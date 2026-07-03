import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { usePedidos } from '../hooks/usePedidos';
import { useLlamados } from '../hooks/useLlamados';
import { PedidoCard } from '../components/PedidoCard';
import { PedidoDetalleModal } from '../components/PedidoDetalleModal';
import { LlamadoActivoCard, LlamadoHistorialCard } from '../components/LlamadoCards';
import { PulsoFooter } from '../components/PulsoFooter';
import { colors } from '../theme';
import { requestNotificationPermissions } from '../lib/notifications';
import { Id, Pedido, PedidoItem } from '../types/db';

type Tab = 'pedidos' | 'llamados';
type Sub = 'activos' | 'historial';

function Segmented<T extends string>({
  value,
  options,
  onChange,
  big,
}: {
  value: T;
  options: { key: T; label: string; badge?: number }[];
  onChange: (v: T) => void;
  big?: boolean;
}) {
  return (
    <View style={[styles.seg, big && styles.segBig]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            style={[styles.segItem, active && styles.segItemActive]}
            onPress={() => onChange(o.key)}
          >
            <Text style={[styles.segText, big && styles.segTextBig, active && styles.segTextActive]}>
              {o.label}
              {o.badge ? `  ${o.badge}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PanelScreen() {
  const { session } = useAuth();
  const zonas = session?.zonas ?? [];
  const meseroId = session?.id ?? '';

  const pedidos = usePedidos(zonas, meseroId);
  const llamados = useLlamados(zonas, meseroId);

  const [tab, setTab] = useState<Tab>('pedidos');
  const [sub, setSub] = useState<Sub>('activos');
  const [busyId, setBusyId] = useState<Id | null>(null);

  // Items de los pedidos visibles (para mostrar el detalle en las tarjetas).
  const [itemsMap, setItemsMap] = useState<Record<string, PedidoItem[]>>({});
  const [detalle, setDetalle] = useState<Pedido | null>(null);

  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  // Traer items de todos los pedidos visibles (activos + historial).
  const pedidoIdsKey = useMemo(
    () => [...pedidos.activos, ...pedidos.historial].map((p) => p.id).join(','),
    [pedidos.activos, pedidos.historial],
  );
  useEffect(() => {
    const ids = [...pedidos.activos, ...pedidos.historial].map((p) => p.id);
    if (!ids.length) {
      setItemsMap({});
      return;
    }
    let cancelled = false;
    pedidos.fetchItemsForPedidos(ids).then((m) => {
      if (!cancelled) setItemsMap(m);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoIdsKey]);

  const onSetEstado = async (id: Id, estado: string) => {
    setBusyId(id);
    await pedidos.setEstadoPedido(id, estado);
    setBusyId(null);
  };
  const onAtender = async (id: Id) => {
    setBusyId(id);
    await llamados.atender(id);
    setBusyId(null);
  };
  const onCancelar = async (id: Id) => {
    setBusyId(id);
    await llamados.cancelarAtendido(id);
    setBusyId(null);
  };

  // ---- Datos y render según pestaña ----
  const { data, renderItem, refreshing, onRefresh, emptyText } = useMemo(() => {
    if (tab === 'pedidos') {
      const list = sub === 'activos' ? pedidos.activos : pedidos.historial;
      return {
        data: list as unknown[],
        refreshing: pedidos.loading,
        onRefresh: pedidos.refetch,
        emptyText: sub === 'activos' ? 'No hay pedidos activos' : 'Sin pedidos entregados hoy',
        renderItem: ({ item }: { item: unknown }) => {
          const p = item as Pedido;
          return (
            <PedidoCard
              pedido={p}
              items={itemsMap[String(p.id)]}
              modo={sub === 'activos' ? 'activo' : 'historial'}
              onPress={() => setDetalle(p)}
              onSetEstado={onSetEstado}
              busy={busyId === p.id}
            />
          );
        },
      };
    }
    // llamados
    const list = sub === 'activos' ? llamados.activos : llamados.historial;
    return {
      data: list as unknown[],
      refreshing: llamados.loading,
      onRefresh: async () => {},
      emptyText: sub === 'activos' ? 'No hay llamados activos' : 'Sin llamados atendidos hoy',
      renderItem: ({ item }: { item: unknown }) =>
        sub === 'activos' ? (
          <LlamadoActivoCard
            llamado={item as never}
            onAtender={onAtender}
            busy={busyId === (item as Pedido).id}
          />
        ) : (
          <LlamadoHistorialCard
            llamado={item as never}
            onCancelar={onCancelar}
            busy={busyId === (item as Pedido).id}
          />
        ),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, sub, pedidos, llamados, itemsMap, busyId]);

  const error = pedidos.error ?? llamados.error;

  return (
    <View style={styles.container}>
      <Segmented<Tab>
        big
        value={tab}
        onChange={(v) => setTab(v)}
        options={[
          { key: 'pedidos', label: 'PEDIDOS', badge: pedidos.activos.length || undefined },
          { key: 'llamados', label: 'LLAMADOS', badge: llamados.activos.length || undefined },
        ]}
      />
      <Segmented<Sub>
        value={sub}
        onChange={(v) => setSub(v)}
        options={[
          { key: 'activos', label: 'Activos' },
          { key: 'historial', label: 'Historial' },
        ]}
      />

      {!zonas.length ? (
        <Text style={styles.warn}>⚠️ Sin zonas asignadas</Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={data}
        keyExtractor={(item, i) => `${(item as Pedido).id ?? i}`}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
        }
        ListEmptyComponent={
          !refreshing ? <Text style={styles.empty}>{emptyText}</Text> : null
        }
      />

      <PulsoFooter />

      <PedidoDetalleModal
        pedido={detalle}
        items={detalle ? itemsMap[String(detalle.id)] ?? [] : []}
        loading={false}
        onClose={() => setDetalle(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  seg: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 4,
  },
  segBig: { marginTop: 12 },
  segItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  segItemActive: { backgroundColor: colors.gold },
  segText: { color: colors.textDim, fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  segTextBig: { fontSize: 15 },
  segTextActive: { color: '#000' },
  warn: { color: colors.amber, textAlign: 'center', marginTop: 10, fontWeight: '700' },
  error: {
    color: '#fff',
    backgroundColor: colors.red,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 8,
    borderRadius: 8,
    fontWeight: '600',
  },
  list: { padding: 16, flexGrow: 1 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 60, fontSize: 15 },
});
