import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { hora12 } from '../lib/fecha';
import { money } from '../lib/money';
import { Cronometro } from './Cronometro';
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
  onPress: () => void;
  onSetEstado: (id: Id, estado: string) => void;
  preparadoPor?: string | null;
  busy?: boolean;
}

const ESTADO_LABEL: Record<string, string> = {
  [PEDIDO_PENDIENTE]: 'PENDIENTE',
  [PEDIDO_EN_PREPARACION]: 'EN PREPARACIÓN',
  [PEDIDO_ENTREGADO]: 'ENTREGADO',
};

/** Tarjeta de un pedido ACTIVO (pendiente / en preparación). */
export function PedidoCard({ pedido, items, onPress, onSetEstado, preparadoPor, busy }: Props) {
  const numero = pedido.numero ?? pedido.id;
  const enPrep = pedido.estado === PEDIDO_EN_PREPARACION;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      {/* Encabezado: nº pedido + hora | pill de estado */}
      <View style={styles.headRow}>
        <Text style={styles.numero}>
          📝 PEDIDO #{String(numero)} · {hora12(pedido.created_at).toUpperCase()}
        </Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{ESTADO_LABEL[pedido.estado] ?? pedido.estado}</Text>
        </View>
      </View>

      {/* Ubicación + cronómetro */}
      <View style={styles.ubiRow}>
        <Text style={styles.ubicacion}>{pedido.ubicacion}</Text>
        <Cronometro desde={pedido.created_at} />
      </View>

      {/* Cliente + teléfono */}
      {pedido.nombre_cliente || pedido.telefono_cliente ? (
        <Text style={styles.cliente}>
          {pedido.nombre_cliente ?? ''}
          {pedido.nombre_cliente && pedido.telefono_cliente ? ' · ' : ''}
          {pedido.telefono_cliente ? (
            <Text
              style={styles.tel}
              onPress={() => Linking.openURL(`tel:${pedido.telefono_cliente}`).catch(() => {})}
            >
              {pedido.telefono_cliente}
            </Text>
          ) : null}
        </Text>
      ) : null}

      {/* En preparación por X */}
      {enPrep && preparadoPor ? (
        <Text style={styles.prep}>
          En preparación por <Text style={styles.prepNombre}>{preparadoPor}</Text>
        </Text>
      ) : null}

      {/* Detalle */}
      {items && items.length ? (
        <View style={styles.items}>
          {items.map((it, i) => (
            <View key={i}>
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
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.itemsVacio}>Tocá para ver el detalle</Text>
      )}

      {/* Total */}
      <View style={styles.divider} />
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>TOTAL</Text>
        <Text style={styles.totalValue}>{money(pedido.total)}</Text>
      </View>

      {/* Acción */}
      {pedido.estado === PEDIDO_PENDIENTE ? (
        <Pressable
          style={styles.boton}
          onPress={() => onSetEstado(pedido.id, PEDIDO_EN_PREPARACION)}
          disabled={busy}
        >
          <Text style={styles.botonText}>Marcar como En preparación</Text>
        </Pressable>
      ) : (
        <Pressable
          style={styles.boton}
          onPress={() => onSetEstado(pedido.id, PEDIDO_ENTREGADO)}
          disabled={busy}
        >
          <Text style={styles.botonText}>Marcar como Entregado</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  numero: { color: colors.gold, fontSize: 13, fontWeight: '800', flex: 1 },
  pill: {
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.goldSoftBg,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: { color: colors.goldDark, fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  ubiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  ubicacion: { color: colors.text, fontSize: 22, fontWeight: '900', flex: 1 },
  cliente: { color: colors.textDim, fontSize: 14, marginTop: 4 },
  tel: { color: colors.gold, textDecorationLine: 'underline' },
  prep: { color: colors.textDim, fontSize: 13, marginTop: 6 },
  prepNombre: { color: colors.gold, fontWeight: '800' },
  items: { marginTop: 12, gap: 6 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  itemName: { color: colors.text, fontSize: 15, flex: 1 },
  itemQty: { color: colors.gold, fontWeight: '900' },
  itemMod: { color: colors.textMuted, fontSize: 13, marginTop: 1, marginLeft: 2 },
  itemPrecio: { color: colors.gold, fontSize: 15, fontWeight: '700' },
  itemsVacio: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic', marginTop: 10 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: colors.gold, fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  totalValue: { color: colors.gold, fontSize: 20, fontWeight: '900' },
  boton: {
    marginTop: 14,
    backgroundColor: colors.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  botonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
