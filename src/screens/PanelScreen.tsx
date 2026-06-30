import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useFeed } from '../hooks/useFeed';
import { FeedCard } from '../components/FeedCard';
import { FeedItem, Id } from '../types/db';
import {
  requestNotificationPermissions,
  startInsistentVibration,
  stopInsistentVibration,
} from '../lib/notifications';

export function PanelScreen() {
  const { session } = useAuth();
  const zonas = session?.zonas ?? [];
  const { items, loading, error, refetch, markAtendido } = useFeed(zonas, session?.id ?? '');
  const [busyId, setBusyId] = useState<Id | null>(null);

  // Asegurar permisos y canal de notificaciones al entrar al panel.
  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  // Vibración insistente mientras haya llamados/pedidos pendientes.
  // Se detiene sola cuando la lista queda vacía (todo atendido).
  useEffect(() => {
    if (items.length > 0) {
      startInsistentVibration();
    } else {
      stopInsistentVibration();
    }
    return () => {
      // Al desmontar (logout / cambio de pantalla) cortamos la vibración.
      stopInsistentVibration();
    };
  }, [items.length]);

  const onAtendido = async (item: FeedItem) => {
    setBusyId(item.id);
    await markAtendido(item);
    setBusyId(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerInfo}>
        <Text style={styles.hola}>Hola, {session?.nombre}</Text>
        <Text style={styles.zonas}>
          {zonas.length ? `Zonas: ${zonas.join(', ')}` : 'Sin zonas asignadas'}
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

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
  hola: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
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
  list: { padding: 16, flexGrow: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 48, color: '#2E7D32' },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#444', marginTop: 12 },
  emptySub: { fontSize: 14, color: '#999', marginTop: 4 },
});
