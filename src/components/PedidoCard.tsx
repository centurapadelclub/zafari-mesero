import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { horaCorta } from '../lib/fecha';
import {
  Id,
  PEDIDO_ENTREGADO,
  PEDIDO_EN_PREPARACION,
  PEDIDO_PENDIENTE,
  Pedido,
  PedidoItem,
} from '../types/db';

interface Props {
  pedido: Pedido;
  items?: PedidoItem[];
  modo: 'activo' | 'historial';
  onPress: () => void;
  onSetEstado?: (id: Id, estado: string) => void;
  busy?: boolean;
}

const ESTADO_LABEL: Record<string, string> = {
  [PEDIDO_PENDIENTE]: 'NUEVO',
  [PEDIDO_EN_PREPARACION]: 'EN PREPARACIÓN',
  [PEDIDO_ENTREGADO]: 'ENTREGADO',
};
const ESTADO_COLOR: Record<string, string> = {
  [PEDIDO_PENDIENTE]: colors.gold,
  [PEDIDO_EN_PREPARACION]: colors.amber,
  [PEDIDO_ENTREGADO]: colors.green,
};

function money(n?: number | null): string {
  return n == null ? '' : `$${Number(n).toLocaleString('es-AR')}`;
}

export function PedidoCard({ pedido, items, modo, onPress, onSetEstado, busy }: Props) {
  const numero = pedido.numero ?? pedido.id;
  const estadoColor = ESTADO_COLOR[pedido.estado] ?? colors.textDim;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.numero}>Pedido #{String(numero)}</Text>
        <View style={[styles.badge, { borderColor: estadoColor }]}>
          <Text style={[styles.badgeText, { color: estadoColor }]}>
            {ESTADO_LABEL[pedido.estado] ?? pedido.estado}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.ubicacion}>{pedido.ubicacion}</Text>
        <Text style={styles.hora}>
          {modo === 'historial' && pedido.atendido_at
            ? `entregado ${horaCorta(pedido.atendido_at)}`
            : horaCorta(pedido.created_at)}
        </Text>
      </View>
      {pedido.nombre_cliente ? <Text style={styles.cliente}>👤 {pedido.nombre_cliente}</Text> : null}

      {/* Detalle de lo que pidieron */}
      {items && items.length ? (
        <View style={styles.items}>
          {items.map((it, i) => (
            <View key={i} style={styles.itemRow}>
              <Text style={styles.itemQty}>{it.cantidad}×</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{it.nombre}</Text>
                {it.modificadores.map((m, j) => (
                  <Text key={j} style={styles.itemMod}>
                    + {m.nombre_opcion}
                    {m.precio_extra ? ` (${money(m.precio_extra)})` : ''}
                  </Text>
                ))}
              </View>
              {it.subtotal != null ? (
                <Text style={styles.itemPrecio}>{money(it.subtotal)}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.itemsVacio}>Tocá para ver el detalle</Text>
      )}

      <View style={styles.footerRow}>
        <Text style={styles.total}>Total {money(pedido.total)}</Text>
        {modo === 'activo' && onSetEstado ? (
          <View>
            {pedido.estado === PEDIDO_PENDIENTE ? (
              <Pressable
                style={[styles.boton, { backgroundColor: colors.amber }]}
                onPress={() => onSetEstado(pedido.id, PEDIDO_EN_PREPARACION)}
                disabled={busy}
              >
                <Text style={styles.botonText}>Marcar en preparación</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.boton, { backgroundColor: colors.green }]}
                onPress={() => onSetEstado(pedido.id, PEDIDO_ENTREGADO)}
                disabled={busy}
              >
                <Text style={styles.botonText}>Marcar entregado</Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  numero: { color: colors.gold, fontSize: 18, fontWeight: '900' },
  badge: { borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  ubicacion: { color: colors.text, fontSize: 16, fontWeight: '700' },
  hora: { color: colors.textDim, fontSize: 13 },
  cliente: { color: colors.textDim, fontSize: 14, marginTop: 2 },
  items: { marginTop: 10, gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemQty: { color: colors.gold, fontWeight: '800', fontSize: 14, minWidth: 28 },
  itemName: { color: colors.text, fontSize: 15 },
  itemMod: { color: colors.textDim, fontSize: 12 },
  itemNota: { color: colors.amber, fontSize: 12 },
  itemPrecio: { color: colors.textDim, fontSize: 13 },
  itemsVacio: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic', marginTop: 8 },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  total: { color: colors.text, fontSize: 16, fontWeight: '800' },
  boton: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  botonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
