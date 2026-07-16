import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Updates from 'expo-updates';
import notifee, { AuthorizationStatus, AndroidNotificationSetting } from '@notifee/react-native';
import {
  getSoundPref,
  setSoundPref,
  SoundPref,
  getTonePref,
  setTonePref,
  TonePref,
} from '../lib/preferences';
import {
  requestNotificationPermissions,
  requestExactAlarmPermission,
  openPowerManagerSettings,
} from '../lib/notifications';
import {
  canUseFullScreenIntent,
  openFullScreenIntentSettings,
  canDrawOverlays,
  openOverlaySettings,
  isIgnoringBatteryOptimizations,
} from '../../modules/lock-screen';

/** Fila de un permiso: título, estado real (si se puede leer) y botón de ajuste. */
function PermRow({
  titulo,
  desc,
  estado,
  onAbrir,
}: {
  titulo: string;
  desc?: string;
  estado: boolean | null;
  onAbrir: () => void;
}) {
  return (
    <View style={styles.permRow}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={styles.permTitulo}>{titulo}</Text>
        {desc ? <Text style={styles.permDesc}>{desc}</Text> : null}
        <Text
          style={[
            styles.permEstado,
            estado === true ? styles.fsiOk : estado === false ? styles.fsiBad : styles.fsiUnknown,
          ]}
        >
          {estado === true
            ? 'PERMITIDO ✅'
            : estado === false
              ? 'BLOQUEADO ❌'
              : 'No se puede leer'}
        </Text>
      </View>
      <Pressable style={styles.permBtn} onPress={onAbrir}>
        <Text style={styles.permBtnText}>Abrir ajuste</Text>
      </Pressable>
    </View>
  );
}

interface PermsState {
  notif: boolean | null;
  alarm: boolean | null;
  overlay: boolean | null;
  battery: boolean | null;
  fsi: boolean | null;
}

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

  // Estado real de los permisos (true/false, o null si no se puede leer).
  const [perms, setPerms] = useState<PermsState>({
    notif: null,
    alarm: null,
    overlay: null,
    battery: null,
    fsi: null,
  });

  const leerPerms = async () => {
    const next: PermsState = { notif: null, alarm: null, overlay: null, battery: null, fsi: null };
    try {
      const s = await notifee.getNotificationSettings();
      next.notif = s.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
      // alarm: ENABLED/NOT_SUPPORTED => concedido; DISABLED => bloqueado.
      next.alarm = s.android?.alarm !== AndroidNotificationSetting.DISABLED;
    } catch {
      // deja notif/alarm en null
    }
    try {
      next.overlay = canDrawOverlays();
    } catch {
      /* null */
    }
    try {
      next.battery = isIgnoringBatteryOptimizations();
    } catch {
      /* null */
    }
    try {
      next.fsi = canUseFullScreenIntent();
    } catch {
      /* null */
    }
    setPerms(next);
  };

  useEffect(() => {
    getSoundPref().then(setPref);
    getTonePref().then(setTono);
    leerPerms();
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

  // --- Actualizaciones OTA ---
  const [otaMsg, setOtaMsg] = useState<string>('');
  const [otaAvailable, setOtaAvailable] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [instalando, setInstalando] = useState(false);

  const buscarUpdate = async () => {
    if (buscando || instalando) return;
    setBuscando(true);
    setOtaMsg('Buscando actualización…');
    try {
      const r = await Updates.checkForUpdateAsync();
      setOtaAvailable(r.isAvailable);
      setOtaMsg(
        r.isAvailable ? 'Hay una actualización disponible' : 'Ya tenés la versión más reciente',
      );
    } catch (e) {
      setOtaAvailable(false);
      setOtaMsg(`No se pudo buscar: ${String(e)}`);
    } finally {
      setBuscando(false);
    }
  };

  const instalarUpdate = async () => {
    if (!otaAvailable || instalando) return;
    setInstalando(true);
    setOtaMsg('Descargando actualización…');
    try {
      await Updates.fetchUpdateAsync();
      setOtaMsg('Reiniciando…');
      await Updates.reloadAsync();
    } catch (e) {
      setInstalando(false);
      setOtaMsg(`No se pudo instalar: ${String(e)}`);
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

        <Text style={[styles.seccion, { marginTop: 24 }]}>Permisos</Text>
        <Text style={styles.nota}>
          Configuración inicial del dispositivo (una sola vez). Tocá "Abrir ajuste" en cada uno y
          activalo; después volvé y tocá "Volver a revisar".
        </Text>

        <PermRow
          titulo="Notificaciones"
          desc="Necesario para recibir cualquier aviso."
          estado={perms.notif}
          onAbrir={() => {
            requestNotificationPermissions().catch(() => {});
          }}
        />
        <PermRow
          titulo="Pantalla completa (llamadas)"
          desc="Android 14+: abre la llamada a pantalla completa aunque esté bloqueado."
          estado={perms.fsi}
          onAbrir={() => {
            try {
              openFullScreenIntentSettings();
            } catch {
              /* no-op */
            }
          }}
        />
        <PermRow
          titulo="Mostrar sobre otras apps"
          desc="Permite superponer la pantalla de llamada."
          estado={perms.overlay}
          onAbrir={() => {
            try {
              openOverlaySettings();
            } catch {
              /* no-op */
            }
          }}
        />
        <PermRow
          titulo="Alarmas exactas"
          desc="Para que el Snooze reprograme la llamada a los 30 s exactos."
          estado={perms.alarm}
          onAbrir={() => {
            requestExactAlarmPermission().catch(() => {});
          }}
        />
        <PermRow
          titulo="Optimización de batería"
          desc="Excluí la app para que el sistema no la cierre en segundo plano."
          estado={perms.battery}
          onAbrir={() => {
            openPowerManagerSettings().catch(() => {});
          }}
        />

        <Pressable style={[styles.btn, styles.btnRevisar]} onPress={leerPerms}>
          <Text style={styles.btnRevisarText}>Volver a revisar</Text>
        </Pressable>

        {Updates.isEnabled ? (
          <>
            <Text style={[styles.seccion, { marginTop: 24 }]}>Actualizaciones</Text>
            {otaMsg ? <Text style={styles.otaMsg}>{otaMsg}</Text> : null}

            <Pressable
              style={[styles.btn, styles.btnBuscar, (buscando || instalando) && styles.btnDisabled]}
              onPress={buscarUpdate}
              disabled={buscando || instalando}
            >
              {buscando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Buscar actualización</Text>
              )}
            </Pressable>

            <Pressable
              style={[
                styles.btn,
                styles.btnInstalar,
                (!otaAvailable || instalando) && styles.btnDisabled,
              ]}
              onPress={instalarUpdate}
              disabled={!otaAvailable || instalando}
            >
              {instalando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>
                  {otaAvailable ? 'Instalar actualización' : 'No hay actualizaciones'}
                </Text>
              )}
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f5f7' },
  container: { padding: 16 },
  otaMsg: { fontSize: 14, color: '#444', marginBottom: 12 },
  fsiOk: { color: '#1B8B4A' },
  fsiBad: { color: '#B71C1C' },
  fsiUnknown: { color: '#888' },
  btnRevisar: { backgroundColor: '#eeeeee' },
  btnRevisarText: { color: '#333', fontSize: 15, fontWeight: '700' },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  permTitulo: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  permDesc: { fontSize: 12, color: '#777', marginTop: 2 },
  permEstado: { fontSize: 13, fontWeight: '800', marginTop: 6 },
  permBtn: {
    backgroundColor: '#D4A017',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  permBtnText: { color: '#000', fontSize: 13, fontWeight: '800' },
  btn: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginBottom: 12 },
  btnBuscar: { backgroundColor: '#D4A017' },
  btnInstalar: { backgroundColor: '#22A45A' },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
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
