import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useHistorial } from '../hooks/useFeed';
import { FeedCard } from '../components/FeedCard';

export function HistorialScreen() {
  const { session } = useAuth();
  const zonas = session?.zonas ?? [];
  const { items, loading, refetch } = useHistorial(zonas);

  return (
    <View style={styles.container}>
      <View style={styles.headerInfo}>
        <Text style={styles.titulo}>Atendidos hoy</Text>
        <Text style={styles.contador}>{items.length} en total</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => `${i.kind}-${i.id}`}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <FeedCard item={item} modo="historial" />}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Todavía no atendiste nada hoy</Text>
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
  titulo: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  contador: { fontSize: 14, color: '#777', marginTop: 2 },
  list: { padding: 16, flexGrow: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, color: '#999' },
});
