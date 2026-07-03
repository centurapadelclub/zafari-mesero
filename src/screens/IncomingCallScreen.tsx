import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import notifee from '@notifee/react-native';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { SlideToAct } from '../components/SlideToAct';
import { startCallVibration, stopCallVibration } from '../lib/notifications';
import { getSoundPref } from '../lib/preferences';
import { LLAMADO_ATENDIDO, PEDIDO_ESTADO_AL_ATENDER, RootStackParamList } from '../types/db';

const RINGTONE = require('../../assets/ringtone.wav');
const LOGO = require('../../assets/logo-zafari.png');
const GOLD = '#D4A017';

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

  // Ringtone en loop mientras la pantalla esté visible (solo si la preferencia
  // es 'sonido + vibración'). La vibración va siempre.
  const player = useAudioPlayer(RINGTONE);

  useEffect(() => {
    let cancelled = false;
    startCallVibration();
    (async () => {
      try {
        const pref = await getSoundPref();
        if (cancelled || pref !== 'sound_vibration') return;
        // Sonar aunque el celular esté en silencio.
        await setAudioModeAsync({ playsInSilentMode: true });
        player.loop = true;
        player.play();
      } catch {
        // sin audio: la vibración sigue funcionando
      }
    })();

    return () => {
      cancelled = true;
      stopCallVibration();
      try {
        player.pause();
      } catch {
        // el player puede haberse liberado al desmontar
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopRingtone = () => {
    try {
      player.pause();
    } catch {
      // ignorar
    }
  };

  const cerrar = () => {
    stopCallVibration();
    stopRingtone();
    notifee.cancelAllNotifications().catch(() => {});
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Tabs' as never);
  };

  const onAtender = async () => {
    if (busy) return;
    setBusy(true);
    stopCallVibration();
    stopRingtone();
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
  const badge = esLlamado ? 'LLAMADO' : 'PEDIDO';
  const subtitulo = tipo || (esLlamado ? 'mesero' : 'nuevo pedido');
  const icono = esLlamado ? '🛎️' : '🍽️';

  return (
    <View style={styles.container}>
      {/* Bokeh / luces desenfocadas de fondo */}
      <View style={[styles.bokeh, styles.bokeh1]} />
      <View style={[styles.bokeh, styles.bokeh2]} />
      <View style={[styles.bokeh, styles.bokeh3]} />

      <SafeAreaView style={styles.safe}>
        {/* Header: logo + marca + badge */}
        <View style={styles.top}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={styles.marca}>ZAFARI</Text>
          <Text style={styles.submarca}>RESTAURANTE BAR</Text>

          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>📞</Text>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
          <Text style={styles.subtitulo}>{subtitulo}</Text>
        </View>

        {/* Centro: círculo con resplandor + ubicación */}
        <View style={styles.middle}>
          <View style={styles.glow}>
            <View style={styles.circle}>
              <Text style={styles.circleIcon}>{icono}</Text>
            </View>
          </View>

          <Text style={styles.label}>Te llaman de</Text>
          <Text style={styles.ubicacion}>{ubicacion}</Text>
          <View style={styles.divider} />
        </View>

        {/* Abajo: deslizable */}
        <View style={styles.bottom}>
          {busy ? (
            <ActivityIndicator color={GOLD} size="large" />
          ) : (
            <>
              <SlideToAct onAtender={onAtender} onIgnorar={cerrar} />
              <Text style={styles.hintIcon}>👆</Text>
              <Text style={styles.hint}>‹‹  Deslizá el botón para atender  ››</Text>
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1a0d' },
  safe: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 24,
  },
  // Luces bokeh de fondo (verde/dorado muy tenue)
  bokeh: { position: 'absolute', borderRadius: 999 },
  bokeh1: {
    width: 220,
    height: 220,
    backgroundColor: 'rgba(212,160,23,0.05)',
    top: -40,
    left: -60,
  },
  bokeh2: {
    width: 260,
    height: 260,
    backgroundColor: 'rgba(212,160,23,0.06)',
    bottom: 40,
    right: -80,
  },
  bokeh3: {
    width: 160,
    height: 160,
    backgroundColor: 'rgba(124,226,154,0.04)',
    bottom: -30,
    left: -30,
  },
  top: { alignItems: 'center' },
  logo: { width: 96, height: 96 },
  marca: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 4, marginTop: 4 },
  submarca: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 7,
    marginTop: 18,
  },
  badgeIcon: { fontSize: 14 },
  badgeText: { color: GOLD, fontSize: 15, fontWeight: '900', letterSpacing: 2 },
  subtitulo: { color: 'rgba(255,255,255,0.85)', fontSize: 16, marginTop: 10 },
  middle: { alignItems: 'center' },
  glow: {
    width: 210,
    height: 210,
    borderRadius: 105,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: GOLD,
    backgroundColor: 'rgba(212,160,23,0.04)',
    shadowColor: GOLD,
    shadowOpacity: 0.9,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
  circle: {
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: '#12281a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleIcon: { fontSize: 76 },
  label: { color: 'rgba(255,255,255,0.85)', fontSize: 18, marginTop: 26 },
  ubicacion: {
    color: '#fff',
    fontSize: 54,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 6,
    letterSpacing: 1,
  },
  divider: { width: 200, height: 2, backgroundColor: GOLD, borderRadius: 1, marginTop: 14, opacity: 0.9 },
  bottom: { alignItems: 'center' },
  hintIcon: { fontSize: 20, marginTop: 16 },
  hint: { color: 'rgba(255,255,255,0.65)', fontSize: 14, marginTop: 6, letterSpacing: 0.5 },
});
