import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { hora12, duracion } from '../lib/fecha';
import { money } from '../lib/money';
import { Id, Pedido } from '../types/db';
import { LlamadoHist } from '../hooks/useLlamados';

function DuracionPill({ desde, hasta }: { desde?: string | null; hasta?: string | null }) {
  const d = duracion(desde, hasta);
  if (!d) return null;
  return (
    <View style={styles.durPill}>
      <Text style={styles.durText}>{d}</Text>
    </View>
  );
}

function Tiempos({ desde, hasta }: { desde?: string | null; hasta?: string | null }) {
  return (
    <Text style={styles.tiempos}>
      {hora12(desde)} → {hora12(hasta)}
    </Text>
  );
}

/** Fila compacta del historial de PEDIDOS entregados hoy. */
export function PedidoHistorialRow({ pedido, onPress }: { pedido: Pedido; onPress: () => void }) {
  const numero = pedido.numero ?? pedido.id;
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.titulo}>
          #{String(numero)} · {pedido.ubicacion}
        </Text>
        {pedido.nombre_cliente ? <Text style={styles.cliente}>{pedido.nombre_cliente}</Text> : null}
        <Tiempos desde={pedido.created_at} hasta={pedido.atendido_at} />
      </View>
      <View style={styles.rightCol}>
        <DuracionPill desde={pedido.created_at} hasta={pedido.atendido_at} />
        <Text style={styles.monto}>{money(pedido.total)}</Text>
      </View>
    </Pressable>
  );
}

/** Fila compacta del historial de LLAMADOS atendidos hoy (con botón Regresar). */
export function LlamadoHistorialRow({
  llamado,
  onRegresar,
  busy,
}: {
  llamado: LlamadoHist;
  onRegresar: (id: Id) => void;
  busy?: boolean;
}) {
  const cliente = [llamado.nombre_cliente, llamado.apellido_cliente].filter(Boolean).join(' ');
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.titulo}>{llamado.ubicacion}</Text>
        {cliente || llamado.telefono_cliente ? (
          <Text style={styles.cliente}>
            {cliente}
            {cliente && llamado.telefono_cliente ? ' · ' : ''}
            {llamado.telefono_cliente ?? ''}
          </Text>
        ) : null}
        {llamado.atendidoPor ? (
          <Text style={styles.cliente}>
            Atendido por <Text style={styles.porNombre}>{llamado.atendidoPor}</Text>
          </Text>
        ) : null}
        <Tiempos desde={llamado.created_at} hasta={llamado.atendido_at} />
      </View>
      <View style={styles.rightCol}>
        <DuracionPill desde={llamado.created_at} hasta={llamado.atendido_at} />
        <Pressable style={styles.regresar} onPress={() => onRegresar(llamado.id)} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={colors.gold} size="small" />
          ) : (
            <Text style={styles.regresarText}>↩ Regresar</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 10,
  },
  titulo: { color: colors.text, fontSize: 15, fontWeight: '800' },
  cliente: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  porNombre: { color: colors.gold, fontWeight: '700' },
  tiempos: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontVariant: ['tabular-nums'] },
  rightCol: { alignItems: 'flex-end', gap: 6 },
  durPill: {
    backgroundColor: colors.pillBg,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  durText: { color: colors.textDim, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  monto: { color: colors.gold, fontSize: 15, fontWeight: '900' },
  regresar: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  regresarText: { color: colors.gold, fontSize: 12, fontWeight: '800' },
});
