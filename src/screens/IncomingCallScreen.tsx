import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import notifee from '@notifee/react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { SlideToAct } from '../components/SlideToAct';
import { startCallVibration, stopCallVibration } from '../lib/notifications';
import { LLAMADO_ATENDIDO, PEDIDO_ESTADO_AL_ATENDER, RootStackParamList } from '../types/db';

type IncomingRoute = RouteProp<RootStackParamList, 'IncomingCall'>;

/**
 * Escenario 2: pantalla estilo "llamada entrante" que se muestra a pantalla
 * completa (la lanza el Full Screen Intent de notifee cuando el celular está
 * bloqueado / pantalla apagada).
 */
export function IncomingCallScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<IncomingRoute>();
  const { session } = useAuth();
  const { kind, id, ubicacion, tipo } = params;
  const [busy, setBusy] = useState(false);

  // Vibración tipo llamada al aparecer; se corta sola a los 10 s o al actuar.
  useEffect(() => {
    startCallVibration();
    return () => stopCallVibration();
  }, []);

  const cerrar = () => {
    stopCallVibration();
    notifee.cancelAllNotifications().catch(() => {});
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Tabs' as never);
  };

  const onAtender = async () => {
    if (busy) return;
    setBusy(true);
    stopCallVibration();
    const table = kind === 'llamado' ? 'llamados' : 'pedidos';
    const nuevoEstado = kind === 'llamado' ? LLAMADO_ATENDIDO : PEDIDO_ESTADO_AL_ATENDER;
    await supabase
      .from(table)
      .update({
        estado: nuevoEstado,
        atendido_at: new Date().toISOString(),
        mesero_id: session?.id ?? null,
      })
      .eq('id', id);
    cerrar();
  };

  const esLlamado = kind === 'llamado';

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.tag}>{esLlamado ? 'LLAMADO' : 'PEDIDO'}</Text>
        <Text style={styles.tipo}>{tipo ? tipo : esLlamado ? 'Atención en mesa' : 'Nuevo pedido'}</Text>
      </View>

      <View style={styles.middle}>
        <Text style={styles.label}>Te llaman de</Text>
        <Text style={styles.ubicacion}>{ubicacion}</Text>
      </View>

      <View style={styles.bottom}>
        {busy ? (
          <ActivityIndicator color="#fff" size="large" />
        ) : (
          <SlideToAct onAtender={onAtender} onIgnorar={cerrar} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#B71C1C', paddingVertical: 60, paddingHorizontal: 24 },
  top: { alignItems: 'center' },
  tag: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 2,
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tipo: { color: 'rgba(255,255,255,0.9)', fontSize: 18, marginTop: 12, fontWeight: '600' },
  middle: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  label: { color: 'rgba(255,255,255,0.8)', fontSize: 18 },
  ubicacion: { color: '#fff', fontSize: 52, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  bottom: { alignItems: 'center' },
});
