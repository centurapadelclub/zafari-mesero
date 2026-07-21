import React from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { hora12, duracion } from '../lib/fecha';
import { money } from '../lib/money';
import { Pedido, PedidoItem } from '../types/db';

interface Props {
  pedido: Pedido | null;
  items: PedidoItem[];
  loading: boolean;
  onClose: () => void;
}

export function PedidoDetalleModal({ pedido, items, loading, onClose }: Props) {
  return (
    <Modal visible={!!pedido} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {pedido ? (
            <>
              <View style={styles.header}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.numero}>PEDIDO #{String(pedido.numero ?? pedido.id)}</Text>
                  <Text style={styles.ubicacion}>{pedido.ubicacion}</Text>
                </View>
                <Pressable onPress={onClose} hitSlop={10}>
                  <Text style={styles.close}>✕</Text>
                </Pressable>
              </View>

              {pedido.nombre_cliente ? (
                <Text style={styles.meta}>👤 {pedido.nombre_cliente}</Text>
              ) : null}
              {pedido.telefono_cliente ? (
                <Text style={styles.meta}>
                  📞{' '}
                  <Text
                    style={styles.tel}
                    onPress={() =>
                      Linking.openURL(`tel:${pedido.telefono_cliente}`).catch(() => {})
                    }
                  >
                    {pedido.telefono_cliente}
                  </Text>
                </Text>
              ) : null}
              <Text style={styles.meta}>
                🕐 {hora12(pedido.created_at)}
                {pedido.atendido_at
                  ? ` → ${hora12(pedido.atendido_at)} · ${duracion(pedido.created_at, pedido.atendido_at)}`
                  : ''}
              </Text>

              {pedido.notas ? (
                <View style={styles.notaPedido}>
                  <Text style={styles.notaPedidoLabel}>📝 NOTA DEL PEDIDO</Text>
                  <Text style={styles.notaPedidoText}>{pedido.notas}</Text>
                </View>
              ) : null}

              <View style={styles.divider} />

              <ScrollView style={styles.itemsScroll}>
                {loading ? (
                  <Text style={styles.dim}>Cargando detalle…</Text>
                ) : items.length ? (
                  items.map((it, i) => (
                    <View key={i} style={styles.itemBlock}>
                      <View style={styles.itemRow}>
                        <Text style={styles.itemName}>
                          <Text style={styles.itemQty}>{it.cantidad}x </Text>
                          {it.nombre}
                        </Text>
                        {it.subtotal != null ? (
                          <Text style={styles.itemPrecio}>{money(it.subtotal)}</Text>
                        ) : null}
                      </View>
                      {it.modificadores.map((m, j) => (
                        <Text key={j} style={styles.itemMod}>
                          + {m.nombre_opcion}
                          {m.precio_extra ? ` (${money(m.precio_extra)})` : ''}
                        </Text>
                      ))}
                      {it.notas ? <Text style={styles.itemNota}>📝 {it.notas}</Text> : null}
                    </View>
                  ))
                ) : (
                  <Text style={styles.dim}>Sin detalle de items disponible.</Text>
                )}
              </ScrollView>

              <View style={styles.divider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>TOTAL</Text>
                <Text style={styles.totalValue}>{money(pedido.total)}</Text>
              </View>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 20,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  numero: { color: colors.gold, fontSize: 13, fontWeight: '800' },
  ubicacion: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 2 },
  close: { color: colors.textDim, fontSize: 22, fontWeight: '700' },
  meta: { color: colors.textDim, fontSize: 14, marginTop: 6 },
  tel: { color: colors.gold, textDecorationLine: 'underline' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  itemsScroll: { flexGrow: 0 },
  itemBlock: { marginBottom: 10 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  itemName: { color: colors.text, fontSize: 15, flex: 1 },
  itemQty: { color: colors.gold, fontWeight: '900' },
  itemMod: { color: colors.textMuted, fontSize: 13, marginTop: 1, marginLeft: 2 },
  itemNota: { color: colors.gold, fontSize: 13, fontStyle: 'italic', marginTop: 2, marginLeft: 2 },
  itemPrecio: { color: colors.gold, fontSize: 15, fontWeight: '700' },
  notaPedido: {
    marginTop: 12,
    backgroundColor: colors.bg,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  notaPedidoLabel: { color: colors.gold, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  notaPedidoText: { color: colors.text, fontSize: 15, marginTop: 3 },
  dim: { color: colors.textMuted, fontSize: 14, paddingVertical: 16, textAlign: 'center' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: colors.gold, fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  totalValue: { color: colors.gold, fontSize: 20, fontWeight: '900' },
});
