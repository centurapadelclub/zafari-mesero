import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as Updates from 'expo-updates';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePedidos } from '../hooks/usePedidos';
import { useLlamados } from '../hooks/useLlamados';
import { PedidoCard } from '../components/PedidoCard';
import { PedidoDetalleModal } from '../components/PedidoDetalleModal';
import { LlamadoActivoCard } from '../components/LlamadoCards';
import { PedidoHistorialRow, LlamadoHistorialRow } from '../components/HistorialRows';
import { NotificacionesBanner } from '../components/NotificacionesBanner';
import { PulsoFooter } from '../components/PulsoFooter';
import { colors } from '../theme';
import { requestNotificationPermissions } from '../lib/notifications';
import { Id, Pedido, PedidoItem, RootStackParamList } from '../types/db';

type Tab = 'llamados' | 'pedidos';

// Solo lectura: qué OTA update está corriendo (o "embedded" si es el bundle del
// build). Sirve para confirmar en el teléfono cuándo aplicó el último eas update.
const OTA_INFO = (() => {
  try {
    const id = Updates.updateId ? Updates.updateId.slice(0, 8) : 'embedded';
    const created = Updates.createdAt ? Updates.createdAt.toISOString() : '—';
    return `OTA ${id} · ${created}`;
  } catch {
    return 'OTA —';
  }
})();

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{n}</Text>
    </View>
  );
}

export function PanelScreen() {
  const { session, signOut } = useAuth();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Tabs'>>();
  const insets = useSafeAreaInsets();
  const zonas = session?.zonas ?? [];
  const meseroId = session?.id ?? '';
  const nombre = session?.nombre ?? '';

  const pedidos = usePedidos(zonas, meseroId);
  const llamados = useLlamados(zonas, meseroId);

  const [tab, setTab] = useState<Tab>('llamados');
  const [busyId, setBusyId] = useState<Id | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Evita que un doble tap sobre "Salir" dispare el logout varias veces.
  const onSalir = useCallback(() => {
    if (signingOut) return;
    setSigningOut(true);
    signOut().catch(() => setSigningOut(false));
  }, [signingOut, signOut]);

  const [itemsMap, setItemsMap] = useState<Record<string, PedidoItem[]>>({});
  const [detalle, setDetalle] = useState<Pedido | null>(null);

  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  // Deep-link desde la pantalla de pedido entrante ("Ver pedido"): cambia a la
  // pestaña Pedidos y abre el detalle de ese pedido específico.
  const paramTab = route.params?.tab;
  const paramPedidoId = route.params?.openPedidoId;
  useEffect(() => {
    if (paramTab) setTab(paramTab);
    if (paramPedidoId == null) return;
    let cancelled = false;
    (async () => {
      // Buscar el pedido entre los ya cargados; si no está, traerlo directo.
      let p =
        [...pedidos.activos, ...pedidos.historial].find(
          (x) => String(x.id) === String(paramPedidoId),
        ) ?? null;
      if (!p) {
        const { data } = await supabase
          .from('pedidos')
          .select('*')
          .eq('id', paramPedidoId)
          .maybeSingle();
        p = (data as Pedido) ?? null;
      }
      if (cancelled || !p) return;
      // Asegurar que sus items estén disponibles para el modal.
      if (!itemsMap[String(p.id)]) {
        const items = await pedidos.fetchPedidoItems(p.id);
        if (!cancelled) setItemsMap((prev) => ({ ...prev, [String(p!.id)]: items }));
      }
      if (!cancelled) setDetalle(p);
      // Limpiar el param para no reabrir el modal al re-renderizar.
      navigation.setParams({ openPedidoId: undefined } as never);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramTab, paramPedidoId]);

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
  const onRegresar = async (id: Id) => {
    setBusyId(id);
    await llamados.cancelarAtendido(id);
    setBusyId(null);
  };

  const refreshing = tab === 'pedidos' ? pedidos.loading : llamados.loading;
  const onRefresh = () => {
    pedidos.refetch();
  };

  const error = pedidos.error ?? llamados.error;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header: saludo + controles */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>{tab === 'llamados' ? 'MIS LLAMADOS' : 'MIS PEDIDOS'}</Text>
          <Text style={styles.nombre}>{nombre}</Text>
        </View>
        <View style={styles.headerCtrls}>
          <Pressable
            onPress={() => navigation.navigate('Preferences' as never)}
            style={styles.headerBtn}
            hitSlop={8}
          >
            <Text style={styles.gear}>⚙️</Text>
          </Pressable>
          <Pressable
            onPress={onSalir}
            disabled={signingOut}
            style={[styles.salirBtn, signingOut && styles.salirBtnDisabled]}
            hitSlop={8}
          >
            <Text style={styles.salirText}>{signingOut ? 'Saliendo…' : 'Salir'}</Text>
          </Pressable>
        </View>
      </View>

      <NotificacionesBanner />

      {/* Tabs */}
      <View style={styles.tabs}>
        <View style={styles.tabWrap}>
          <Pressable
            style={[styles.tab, tab === 'llamados' ? styles.tabActive : styles.tabInactive]}
            onPress={() => setTab('llamados')}
          >
            <Text style={[styles.tabText, tab === 'llamados' && styles.tabTextActive]}>
              LLAMADOS
            </Text>
          </Pressable>
          <Badge n={llamados.activos.length} />
        </View>
        <View style={styles.tabWrap}>
          <Pressable
            style={[styles.tab, tab === 'pedidos' ? styles.tabActive : styles.tabInactive]}
            onPress={() => setTab('pedidos')}
          >
            <Text style={[styles.tabText, tab === 'pedidos' && styles.tabTextActive]}>
              PEDIDOS
            </Text>
          </Pressable>
          <Badge n={pedidos.activos.length} />
        </View>
      </View>

      {!zonas.length ? <Text style={styles.warn}>⚠️ Sin zonas asignadas</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
        }
      >
        {tab === 'llamados' ? (
          <LlamadosTab
            zonas={zonas}
            activos={llamados.activos}
            historial={llamados.historial}
            onAtender={onAtender}
            onRegresar={onRegresar}
            busyId={busyId}
          />
        ) : (
          <PedidosTab
            activos={pedidos.activos}
            historial={pedidos.historial}
            itemsMap={itemsMap}
            nombrePorMesero={pedidos.nombrePorMesero}
            onSetEstado={onSetEstado}
            onOpen={setDetalle}
            busyId={busyId}
          />
        )}

        <Text style={styles.otaInfo}>{OTA_INFO}</Text>
        <PulsoFooter />
      </ScrollView>

      <PedidoDetalleModal
        pedido={detalle}
        items={detalle ? itemsMap[String(detalle.id)] ?? [] : []}
        loading={false}
        onClose={() => setDetalle(null)}
      />
    </View>
  );
}

function SeccionHistorial({ count, label }: { count: number; label: string }) {
  return (
    <View style={styles.histHead}>
      <Text style={styles.histTitle}>HISTORIAL DE HOY</Text>
      <View style={styles.histPill}>
        <Text style={styles.histPillText}>
          {count} {label}
        </Text>
      </View>
    </View>
  );
}

function LlamadosTab({
  zonas,
  activos,
  historial,
  onAtender,
  onRegresar,
  busyId,
}: {
  zonas: string[];
  activos: ReturnType<typeof useLlamados>['activos'];
  historial: ReturnType<typeof useLlamados>['historial'];
  onAtender: (id: Id) => void;
  onRegresar: (id: Id) => void;
  busyId: Id | null;
}) {
  return (
    <>
      {zonas.length ? (
        <View style={styles.zonaChips}>
          {zonas.map((z) => (
            <View key={z} style={styles.zonaChip}>
              <Text style={styles.zonaChipText}>{z}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {activos.length ? (
        activos.map((l) => (
          <LlamadoActivoCard
            key={String(l.id)}
            llamado={l}
            onAtender={onAtender}
            busy={busyId === l.id}
          />
        ))
      ) : (
        <Text style={styles.empty}>No hay llamados activos</Text>
      )}

      <SeccionHistorial count={historial.length} label="atendidos" />
      {historial.length ? (
        historial.map((l) => (
          <LlamadoHistorialRow
            key={String(l.id)}
            llamado={l}
            onRegresar={onRegresar}
            busy={busyId === l.id}
          />
        ))
      ) : (
        <Text style={styles.emptySmall}>Sin llamados atendidos hoy</Text>
      )}
    </>
  );
}

function PedidosTab({
  activos,
  historial,
  itemsMap,
  nombrePorMesero,
  onSetEstado,
  onOpen,
  busyId,
}: {
  activos: Pedido[];
  historial: Pedido[];
  itemsMap: Record<string, PedidoItem[]>;
  nombrePorMesero: Record<string, string>;
  onSetEstado: (id: Id, estado: string) => void;
  onOpen: (p: Pedido) => void;
  busyId: Id | null;
}) {
  return (
    <>
      {activos.length ? (
        activos.map((p) => (
          <PedidoCard
            key={String(p.id)}
            pedido={p}
            items={itemsMap[String(p.id)]}
            preparadoPor={p.mesero_id != null ? nombrePorMesero[String(p.mesero_id)] : null}
            onPress={() => onOpen(p)}
            onSetEstado={onSetEstado}
            busy={busyId === p.id}
          />
        ))
      ) : (
        <Text style={styles.empty}>No hay pedidos activos</Text>
      )}

      <SeccionHistorial count={historial.length} label="entregados" />
      {historial.length ? (
        historial.map((p) => (
          <PedidoHistorialRow key={String(p.id)} pedido={p} onPress={() => onOpen(p)} />
        ))
      ) : (
        <Text style={styles.emptySmall}>Sin pedidos entregados hoy</Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  kicker: { color: colors.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  nombre: { color: colors.text, fontSize: 30, fontWeight: '900', marginTop: 2 },
  headerCtrls: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  headerBtn: { padding: 6 },
  gear: { fontSize: 20 },
  salirBtn: { paddingVertical: 6, paddingHorizontal: 8 },
  salirBtnDisabled: { opacity: 0.5 },
  salirText: { color: colors.textDim, fontSize: 15, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 14 },
  tabWrap: { flex: 1, position: 'relative' },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  tabActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  tabInactive: { backgroundColor: colors.card, borderColor: colors.border },
  tabText: { color: colors.textDim, fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  tabTextActive: { color: '#fff' },
  badge: {
    position: 'absolute',
    top: -7,
    right: -7,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  warn: { color: colors.goldDark, textAlign: 'center', marginTop: 10, fontWeight: '700' },
  error: {
    color: '#fff',
    backgroundColor: colors.red,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 8,
    borderRadius: 8,
    fontWeight: '600',
  },
  scroll: { padding: 16, paddingBottom: 8 },
  zonaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  zonaChip: {
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.goldSoftBg,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  zonaChipText: { color: colors.goldDark, fontSize: 13, fontWeight: '800' },
  histHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 10,
  },
  histTitle: { color: colors.textDim, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  histPill: {
    backgroundColor: colors.pillBg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  histPillText: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  empty: { color: colors.textMuted, textAlign: 'center', marginVertical: 24, fontSize: 15 },
  emptySmall: { color: colors.textMuted, textAlign: 'center', marginVertical: 12, fontSize: 14 },
  otaInfo: {
    color: colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 14,
    fontVariant: ['tabular-nums'],
  },
});
