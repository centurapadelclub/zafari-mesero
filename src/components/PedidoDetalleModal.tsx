import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { horaCorta } from '../lib/fecha';
import { Pedido, PedidoItem } from '../types/db';

interface Props {
  pedido: Pedido | null;
  items: PedidoItem[];
  loading: boolean;
  onClose: () => void;
}

function money(n?: number | null): string {
  return n == null ? '' : `$${Number(n).toLocaleString('es-AR')}`;
}

export function PedidoDetalleModal({ pedido, items, loading, onClose }: Props) {
  return (
    <Modal visible={!!pedido} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        {pedido ? (
          <>
            <View style={styles.header}>
              <Text style={styles.numero}>Pedido #{String(pedido.numero ?? pedido.id)}</Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.sub}>
              {pedido.ubicacion} · {horaCorta(pedido.created_at)}
            </Text>
            {pedido.nombre_cliente ? (
              <Text style={styles.cliente}>👤 {pedido.nombre_cliente}</Text>
            ) : null}
            {pedido.telefono_cliente ? (
              <Text style={styles.cliente}>📞 {pedido.telefono_cliente}</Text>
            ) : null}

            <ScrollView style={styles.itemsScroll}>
              {loading ? (
                <Text style={styles.dim}>Cargando detalle…</Text>
              ) : items.length ? (
                items.map((it, i) => (
                  <View key={i} style={styles.itemRow}>
                    <Text style={styles.qty}>{it.cantidad}×</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{it.nombre}</Text>
                      {it.modificadores.map((m, j) => (
                        <Text key={j} style={styles.mod}>
                          + {m.nombre_opcion}
                          {m.precio_extra ? ` (${money(m.precio_extra)})` : ''}
                        </Text>
                      ))}
                    </View>
                    {it.subtotal != null ? (
                      <Text style={styles.precio}>{money(it.subtotal)}</Text>
                    ) : null}
                  </View>
                ))
              ) : (
                <Text style={styles.dim}>Sin detalle de items disponible.</Text>
              )}
            </ScrollView>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{money(pedido.total)}</Text>
            </View>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 34,
    maxHeight: '80%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  numero: { color: colors.gold, fontSize: 22, fontWeight: '900' },
  close: { color: colors.textDim, fontSize: 22, fontWeight: '700' },
  sub: { color: colors.textDim, fontSize: 15, marginTop: 4 },
  cliente: { color: colors.text, fontSize: 15, marginTop: 4 },
  itemsScroll: { marginTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  qty: { color: colors.gold, fontWeight: '800', fontSize: 16, minWidth: 32 },
  name: { color: colors.text, fontSize: 16 },
  mod: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  nota: { color: colors.amber, fontSize: 13, marginTop: 2 },
  precio: { color: colors.textDim, fontSize: 14 },
  dim: { color: colors.textMuted, fontSize: 14, paddingVertical: 16, textAlign: 'center' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  totalLabel: { color: colors.textDim, fontSize: 16 },
  totalValue: { color: colors.gold, fontSize: 22, fontWeight: '900' },
});
