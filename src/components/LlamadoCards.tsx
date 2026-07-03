import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { horaCorta } from '../lib/fecha';
import { Cronometro } from './Cronometro';
import { Id, Llamado } from '../types/db';
import { LlamadoHist } from '../hooks/useLlamados';

export function LlamadoActivoCard({
  llamado,
  onAtender,
  busy,
}: {
  llamado: Llamado;
  onAtender: (id: Id) => void;
  busy?: boolean;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.ubicacion}>{llamado.ubicacion}</Text>
          {llamado.tipo ? <Text style={styles.tipo}>{llamado.tipo}</Text> : null}
          {llamado.nombre_cliente ? (
            <Text style={styles.cliente}>
              👤 {[llamado.nombre_cliente, llamado.apellido_cliente].filter(Boolean).join(' ')}
            </Text>
          ) : null}
        </View>
        <Cronometro desde={llamado.created_at} />
      </View>

      <Pressable
        style={styles.boton}
        onPress={() => onAtender(llamado.id)}
        disabled={busy}
      >
        {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.botonText}>Atendido</Text>}
      </Pressable>
    </View>
  );
}

export function LlamadoHistorialCard({
  llamado,
  onCancelar,
  busy,
}: {
  llamado: LlamadoHist;
  onCancelar: (id: Id) => void;
  busy?: boolean;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.ubicacion}>{llamado.ubicacion}</Text>
          {llamado.tipo ? <Text style={styles.tipo}>{llamado.tipo}</Text> : null}
        </View>
        <Text style={styles.hora}>✓ {horaCorta(llamado.atendido_at)}</Text>
      </View>

      <Text style={styles.atendidoPor}>Atendido por {llamado.atendidoPor ?? '—'}</Text>

      <Pressable style={styles.botonDeshacer} onPress={() => onCancelar(llamado.id)} disabled={busy}>
        {busy ? (
          <ActivityIndicator color={colors.gold} />
        ) : (
          <Text style={styles.botonDeshacerText}>Cancelar atendido (volver a activo)</Text>
        )}
      </Pressable>
    </View>
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
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ubicacion: { color: colors.text, fontSize: 20, fontWeight: '800' },
  tipo: { color: colors.gold, fontSize: 13, fontWeight: '700', marginTop: 2 },
  cliente: { color: colors.textDim, fontSize: 14, marginTop: 4 },
  hora: { color: colors.green, fontSize: 16, fontWeight: '800' },
  atendidoPor: { color: colors.textDim, fontSize: 14, marginTop: 8 },
  boton: {
    marginTop: 14,
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  botonText: { color: '#000', fontSize: 17, fontWeight: '900' },
  botonDeshacer: {
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  botonDeshacerText: { color: colors.gold, fontSize: 14, fontWeight: '800' },
});
