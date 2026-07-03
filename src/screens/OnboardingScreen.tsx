import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as IntentLauncher from 'expo-intent-launcher';
import { setOnboardingDone } from '../lib/preferences';
import { requestNotificationPermissions, requestExactAlarmPermission } from '../lib/notifications';

const APP_PACKAGE = 'com.zafari.mesero';

const PASOS = [
  'Tocá el botón "Abrir configuración" de abajo.',
  'Buscá "Zafari Mesero" en la lista.',
  'Activá el permiso "Permitir mostrar sobre otras apps".',
  'Volvé a la app y tocá "Ya lo activé".',
];

/**
 * Onboarding del primer login: explica y lleva al ajuste de Android
 * "Mostrar sobre otras apps" (SYSTEM_ALERT_WINDOW), necesario para que la
 * llamada entrante (Esc2) aparezca a pantalla completa sobre el bloqueo.
 */
export function OnboardingScreen() {
  const navigation = useNavigation();
  const [abriendo, setAbriendo] = useState(false);

  const abrirAjustes = async () => {
    if (Platform.OS !== 'android') return;
    setAbriendo(true);
    try {
      await IntentLauncher.startActivityAsync(
        'android.settings.action.MANAGE_OVERLAY_PERMISSION',
        { data: `package:${APP_PACKAGE}` },
      );
    } catch {
      // Fallback: ajustes de la app.
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
        { data: `package:${APP_PACKAGE}` },
      ).catch(() => {});
    } finally {
      setAbriendo(false);
    }
  };

  const continuar = async () => {
    await requestNotificationPermissions(); // pedir permiso de notificaciones también
    await setOnboardingDone();
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' as never }] });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.emoji}>🔔</Text>
        <Text style={styles.titulo}>Activá las llamadas a pantalla completa</Text>
        <Text style={styles.intro}>
          Para que un llamado te aparezca como una llamada entrante (a pantalla completa,
          aunque tengas el celular guardado o bloqueado), Android necesita un permiso extra:
          <Text style={styles.bold}> "Mostrar sobre otras apps"</Text>.
        </Text>

        <View style={styles.pasos}>
          {PASOS.map((p, i) => (
            <View key={i} style={styles.pasoRow}>
              <View style={styles.num}>
                <Text style={styles.numText}>{i + 1}</Text>
              </View>
              <Text style={styles.pasoText}>{p}</Text>
            </View>
          ))}
        </View>

        <Pressable style={styles.botonPrimario} onPress={abrirAjustes} disabled={abriendo}>
          <Text style={styles.botonPrimarioText}>Abrir configuración</Text>
        </Pressable>

        <Text style={styles.intro}>
          Además, para que el botón <Text style={styles.bold}>Snooze</Text> vuelva a llamarte a los
          30 segundos exactos, Android pide permitir <Text style={styles.bold}>alarmas exactas</Text>.
        </Text>
        <Pressable style={styles.botonSecundario} onPress={() => requestExactAlarmPermission()}>
          <Text style={styles.botonSecundarioText}>Permitir alarmas exactas (snooze)</Text>
        </Pressable>

        <Pressable style={styles.botonSecundario} onPress={continuar}>
          <Text style={styles.botonSecundarioText}>Ya lo activé — continuar</Text>
        </Pressable>

        <Text style={styles.omitir} onPress={continuar}>
          Omitir por ahora
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 24, paddingTop: 12 },
  emoji: { fontSize: 46, textAlign: 'center' },
  titulo: { fontSize: 24, fontWeight: '900', color: '#1a1a1a', textAlign: 'center', marginTop: 8 },
  intro: { fontSize: 15, color: '#555', lineHeight: 22, marginTop: 14 },
  bold: { fontWeight: '800', color: '#D32F2F' },
  pasos: { marginTop: 22, marginBottom: 8 },
  pasoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  num: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#D32F2F',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  numText: { color: '#fff', fontWeight: '800' },
  pasoText: { flex: 1, fontSize: 15, color: '#333', lineHeight: 22 },
  botonPrimario: {
    backgroundColor: '#D32F2F',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  botonPrimarioText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  botonSecundario: {
    borderWidth: 2,
    borderColor: '#D32F2F',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  botonSecundarioText: { color: '#D32F2F', fontSize: 16, fontWeight: '800' },
  omitir: { textAlign: 'center', color: '#999', marginTop: 18, fontSize: 14, paddingVertical: 8 },
});
