import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useFeed, ConnStatus } from '../hooks/useFeed';
import { FeedCard } from '../components/FeedCard';
import { FeedItem, Id } from '../types/db';
import { requestNotificationPermissions } from '../lib/notifications';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const CONN_UI: Record<ConnStatus, { color: string; label: string }> = {
  connected: { color: '#2E7D32', label: 'Conectado' },
  connecting: { color: '#F57C00', label: 'Conectando…' },
  error: { color: '#D32F2F', label: 'Sin conexión' },
};

export function PanelScreen() {
  const { session } = useAuth();
  const zonas = session?.zonas ?? [];
  const { items, loading, error, realtimeStatus, refetch, markAtendido } = useFeed(
    zonas,
    session?.id ?? '',
  );
  const [busyId, setBusyId] = useState<Id | null>(null);
  const conn = CONN_UI[realtimeStatus];

  // Asegurar permisos y canales de notificación al entrar al panel.
  // La vibración/alerta ya no se maneja acá: la definen los escenarios de
  // notificación (Esc2 llamada entrante / Esc3 heads-up).
  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  // ---- DEBUG TEMPORAL: cadena completa mesero → asignaciones → zonas ----
  // Replica en pantalla exactamente lo que hace resolveZonasForMesero, paso a
  // paso, para ver dónde se corta. Quitar cuando se confirme.
  const [zonasRaw, setZonasRaw] = useState<string>('cargando…');
  useEffect(() => {
    (async () => {
      const mid = session?.id;
      let o = `mesero_id=${JSON.stringify(mid)} (${typeof mid})\n`;
      o += `session.zonas=${JSON.stringify(session?.zonas ?? [])}\n`;
      try {
        const asig = await supabase.from('asignaciones').select('*').eq('mesero_id', mid ?? '');
        o += `[1] asignaciones err=${asig.error ? asig.error.message : 'ok'}\n`;
        o += `    raw=${JSON.stringify(asig.data)}\n`;
        const zonaIds = (asig.data ?? [])
          .map((a: { zona_id?: unknown }) => a.zona_id)
          .filter((v) => v != null);
        o += `[2] zonaIds=${JSON.stringify(zonaIds)}\n`;
        if (zonaIds.length) {
          const z = await supabase
            .from('zonas')
            .select('*')
            .in('id', zonaIds as (string | number)[]);
          o += `[3] zonas err=${z.error ? z.error.message : 'ok'}\n`;
          o += `    raw=${JSON.stringify(z.data)}\n`;
          o += `[4] columnas=${z.data && z.data[0] ? JSON.stringify(Object.keys(z.data[0])) : '[]'}\n`;
        } else {
          o += `[3] (sin zonaIds → no se consulta zonas)\n`;
        }
      } catch (err) {
        o += `EXCEPTION: ${String(err)}\n`;
      }
      // eslint-disable-next-line no-console
      console.log('[dbgZonas]\n' + o);
      setZonasRaw(o);
    })();
  }, [session?.id]);

  const onAtendido = async (item: FeedItem) => {
    setBusyId(item.id);
    await markAtendido(item);
    setBusyId(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerInfo}>
        <View style={styles.headerTop}>
          <Text style={styles.hola}>Hola, {session?.nombre}</Text>
          <View style={styles.connChip}>
            <View style={[styles.dot, { backgroundColor: conn.color }]} />
            <Text style={[styles.connText, { color: conn.color }]}>{conn.label}</Text>
          </View>
        </View>
        <Text style={styles.zonas}>
          {zonas.length ? `Zonas: ${zonas.join(', ')}` : '⚠️ Sin zonas asignadas'}
        </Text>
      </View>

      {!isSupabaseConfigured ? (
        <Text style={styles.error}>
          ⚠️ Faltan las credenciales de Supabase en el build (EXPO_PUBLIC_*).
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* DEBUG TEMPORAL — cadena mesero→asignaciones→zonas (quitar luego) */}
      <ScrollView style={styles.debugBox} nestedScrollEnabled>
        <Text style={styles.debugTitle}>🔧 DEBUG zonas</Text>
        <Text style={styles.debugText}>{zonasRaw}</Text>
      </ScrollView>

      <FlatList
        data={items}
        keyExtractor={(i) => `${i.kind}-${i.id}`}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <FeedCard item={item} onAtendido={onAtendido} busy={busyId === item.id} />
        )}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>✓</Text>
              <Text style={styles.emptyText}>No hay llamados pendientes</Text>
              <Text style={styles.emptySub}>Te avisamos apenas llegue uno</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  headerInfo: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hola: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  connChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    elevation: 1,
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  connText: { fontSize: 12, fontWeight: '800' },
  zonas: { fontSize: 14, color: '#777', marginTop: 2 },
  error: {
    color: '#fff',
    backgroundColor: '#D32F2F',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    borderRadius: 8,
    fontWeight: '600',
  },
  debugBox: {
    maxHeight: 170,
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 10,
  },
  debugTitle: { color: '#ffb300', fontSize: 11, fontWeight: '800', marginBottom: 4 },
  debugText: { color: '#8ef', fontSize: 11, fontFamily: 'monospace' },
  list: { padding: 16, flexGrow: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 48, color: '#2E7D32' },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#444', marginTop: 12 },
  emptySub: { fontSize: 14, color: '#999', marginTop: 4 },
});
