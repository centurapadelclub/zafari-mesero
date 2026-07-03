import React from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { hora12 } from '../lib/fecha';
import { Cronometro } from './Cronometro';
import { Id, Llamado } from '../types/db';

/** Tarjeta de un llamado ACTIVO (pendiente). */
export function LlamadoActivoCard({
  llamado,
  onAtender,
  busy,
}: {
  llamado: Llamado;
  onAtender: (id: Id) => void;
  busy?: boolean;
}) {
  const cliente = [llamado.nombre_cliente, llamado.apellido_cliente].filter(Boolean).join(' ');
  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Text style={styles.tipo}>🔔 {(llamado.tipo ?? 'LLAMADO').toUpperCase()}</Text>
        <Text style={styles.hora}>{hora12(llamado.created_at)}</Text>
      </View>

      <View style={styles.ubiRow}>
        <Text style={styles.ubicacion}>{llamado.ubicacion}</Text>
        <Cronometro desde={llamado.created_at} />
      </View>

      {cliente || llamado.telefono_cliente ? (
        <Text style={styles.cliente}>
          {cliente}
          {cliente && llamado.telefono_cliente ? ' · ' : ''}
          {llamado.telefono_cliente ? (
            <Text
              style={styles.tel}
              onPress={() => Linking.openURL(`tel:${llamado.telefono_cliente}`).catch(() => {})}
            >
              {llamado.telefono_cliente}
            </Text>
          ) : null}
        </Text>
      ) : null}

      <Pressable style={styles.boton} onPress={() => onAtender(llamado.id)} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.botonText}>✓ Atendido</Text>
        )}
      </Pressable>
    </View>
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
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tipo: { color: colors.gold, fontSize: 13, fontWeight: '900', letterSpacing: 0.4 },
  hora: { color: colors.textDim, fontSize: 13 },
  ubiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  ubicacion: { color: colors.text, fontSize: 22, fontWeight: '900', flex: 1 },
  cliente: { color: colors.textDim, fontSize: 14, marginTop: 4 },
  tel: { color: colors.gold, textDecorationLine: 'underline' },
  boton: {
    marginTop: 14,
    backgroundColor: colors.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  botonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
