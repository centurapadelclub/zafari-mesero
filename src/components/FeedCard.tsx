import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { FeedItem } from '../types/db';
import { Cronometro } from './Cronometro';

interface Props {
  item: FeedItem;
  onAtendido?: (item: FeedItem) => void;
  busy?: boolean;
  /** En el historial mostramos la hora de atención en vez del cronómetro/botón. */
  modo?: 'pendiente' | 'historial';
}

function horaCorta(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function FeedCard({ item, onAtendido, busy, modo = 'pendiente' }: Props) {
  const esLlamado = item.kind === 'llamado';

  return (
    <View style={[styles.card, esLlamado ? styles.cardLlamado : styles.cardPedido]}>
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, esLlamado ? styles.badgeLlamado : styles.badgePedido]}>
            <Text style={styles.badgeText}>{esLlamado ? 'LLAMADO' : 'PEDIDO'}</Text>
          </View>
          <Text style={styles.zona}>{item.zona}</Text>
        </View>

        {modo === 'pendiente' ? (
          <Cronometro desde={item.created_at} />
        ) : (
          <Text style={styles.horaAtendido}>✓ {horaCorta(item.atendido_at)}</Text>
        )}
      </View>

      <Text style={styles.mesa}>Mesa {String(item.mesa)}</Text>
      {item.descripcion ? <Text style={styles.descripcion}>{item.descripcion}</Text> : null}

      {modo === 'pendiente' && onAtendido ? (
        <Pressable
          style={({ pressed }) => [styles.boton, pressed && styles.botonPressed]}
          onPress={() => onAtendido(item)}
          disabled={busy}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botonText}>Atendido</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardLlamado: { borderLeftColor: '#D32F2F' },
  cardPedido: { borderLeftColor: '#1976D2' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeLlamado: { backgroundColor: '#FDECEA' },
  badgePedido: { backgroundColor: '#E3F2FD' },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, color: '#333' },
  zona: { fontSize: 13, color: '#666', fontWeight: '600' },
  horaAtendido: { fontSize: 15, fontWeight: '700', color: '#2E7D32' },
  mesa: { fontSize: 26, fontWeight: '800', color: '#1a1a1a' },
  descripcion: { fontSize: 15, color: '#444', marginTop: 4 },
  boton: {
    marginTop: 14,
    backgroundColor: '#2E7D32',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  botonPressed: { backgroundColor: '#1B5E20' },
  botonText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
