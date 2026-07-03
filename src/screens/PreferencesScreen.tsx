import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import {
  getSoundPref,
  setSoundPref,
  SoundPref,
  getTonePref,
  setTonePref,
  TonePref,
} from '../lib/preferences';

const OPCIONES: { value: SoundPref; titulo: string; desc: string; icon: string }[] = [
  {
    value: 'sound_vibration',
    titulo: 'Sonido + vibración',
    desc: 'La llamada entrante suena y vibra.',
    icon: '🔊',
  },
  {
    value: 'vibration_only',
    titulo: 'Solo vibración',
    desc: 'La llamada entrante solo vibra (sin sonido).',
    icon: '📳',
  },
];

const TONOS: { value: TonePref; titulo: string; desc: string; icon: string }[] = [
  { value: 'suave', titulo: 'Notificación suave', desc: 'Campanita corta y discreta.', icon: '🎐' },
  { value: 'timbre', titulo: 'Timbre de teléfono', desc: 'Timbre clásico de llamada.', icon: '📞' },
  { value: 'alarma', titulo: 'Alarma', desc: 'Beeps fuertes e insistentes.', icon: '⏰' },
];

const TONE_SOURCES: Record<TonePref, ReturnType<typeof require>> = {
  suave: require('../../assets/notif-suave.wav'),
  timbre: require('../../assets/ringtone.wav'),
  alarma: require('../../assets/alarma.wav'),
};

export function PreferencesScreen() {
  const [pref, setPref] = useState<SoundPref | null>(null);
  const [tono, setTono] = useState<TonePref | null>(null);
  const preview = useAudioPlayer(TONE_SOURCES.timbre);

  useEffect(() => {
    getSoundPref().then(setPref);
    getTonePref().then(setTono);
  }, []);

  const elegir = async (value: SoundPref) => {
    setPref(value);
    await setSoundPref(value);
  };

  const elegirTono = async (value: TonePref) => {
    setTono(value);
    await setTonePref(value);
    // Reproducir una vista previa del tono elegido.
    try {
      await setAudioModeAsync({ playsInSilentMode: true });
      preview.replace(TONE_SOURCES[value]);
      preview.seekTo(0);
      preview.play();
    } catch {
      // sin audio: no pasa nada
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.seccion}>Alertas de llamada entrante</Text>
        <Text style={styles.nota}>
          Aplica cuando el celular está guardado o con la pantalla apagada. Con la app en
          uso, los avisos son siempre solo vibración.
        </Text>

        {OPCIONES.map((o) => {
          const activa = pref === o.value;
          return (
            <Pressable
              key={o.value}
              style={[styles.opcion, activa && styles.opcionActiva]}
              onPress={() => elegir(o.value)}
            >
              <Text style={styles.icon}>{o.icon}</Text>
              <View style={styles.textos}>
                <Text style={styles.titulo}>{o.titulo}</Text>
                <Text style={styles.desc}>{o.desc}</Text>
              </View>
              <View style={[styles.radio, activa && styles.radioActivo]}>
                {activa ? <View style={styles.radioDot} /> : null}
              </View>
            </Pressable>
          );
        })}

        <Text style={[styles.seccion, { marginTop: 24 }]}>Tono de la llamada</Text>
        <Text style={styles.nota}>Tocá una opción para escuchar una vista previa.</Text>

        {TONOS.map((o) => {
          const activa = tono === o.value;
          return (
            <Pressable
              key={o.value}
              style={[styles.opcion, activa && styles.opcionActiva]}
              onPress={() => elegirTono(o.value)}
            >
              <Text style={styles.icon}>{o.icon}</Text>
              <View style={styles.textos}>
                <Text style={styles.titulo}>{o.titulo}</Text>
                <Text style={styles.desc}>{o.desc}</Text>
              </View>
              <View style={[styles.radio, activa && styles.radioActivo]}>
                {activa ? <View style={styles.radioDot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f5f7' },
  container: { padding: 16 },
  seccion: { fontSize: 14, fontWeight: '800', color: '#666', textTransform: 'uppercase', marginBottom: 6 },
  nota: { fontSize: 13, color: '#888', marginBottom: 16 },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  opcionActiva: { borderColor: '#D4A017' },
  icon: { fontSize: 26, marginRight: 14 },
  textos: { flex: 1 },
  titulo: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  desc: { fontSize: 13, color: '#777', marginTop: 2 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#bbb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActivo: { borderColor: '#D4A017' },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#D4A017' },
});
