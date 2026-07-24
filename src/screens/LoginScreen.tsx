import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import { useUpdates } from 'expo-updates';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const APP_VERSION = '1.0.5';
const UPDATE_ID = Updates.updateId ? Updates.updateId.slice(0, 8) : 'dev';
const VERSION_TEXT = `v${APP_VERSION} · update ${UPDATE_ID}`;

interface MeseroOption {
  id: string | number;
  nombre: string;
}

export function LoginScreen() {
  const { signIn } = useAuth();
  const [nombre, setNombre] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [otherDevice, setOtherDevice] = useState(false);
  const pinRef = useRef<TextInput>(null);

  // Selector de nombre (meseros activos desde Supabase)
  const [meseros, setMeseros] = useState<MeseroOption[]>([]);
  const [loadingMeseros, setLoadingMeseros] = useState(true);
  const [meserosError, setMeserosError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Diagnóstico de OTA: si el bundle anterior crasheó al inicializar, el motivo
  // aparece en initializationError. TODO envuelto en try-catch para que este
  // diagnóstico jamás pueda crashear. (Va en el build embebido, no en un OTA.)
  const updatesState = useUpdates();
  let otaErrDiag: string;
  try {
    // initializationError no está tipado en useUpdates de esta versión, pero
    // puede existir en runtime: lo leemos con cast seguro. checkError/downloadError
    // sí existen y capturan errores de arranque/descarga del update.
    const u = updatesState as unknown as {
      initializationError?: { message?: string };
      checkError?: { message?: string };
      downloadError?: { message?: string };
    };
    const initErr = u?.initializationError?.message ?? '—';
    const checkErr = u?.checkError?.message ?? '—';
    const dlErr = u?.downloadError?.message ?? '—';
    let embedded = '?';
    try {
      embedded = String(Updates.isEmbeddedLaunch);
    } catch {
      embedded = 'err';
    }
    otaErrDiag = `emb:${embedded}\ninit: ${initErr}\ncheck: ${checkErr}\ndl: ${dlErr}`;
  } catch (e) {
    otaErrDiag = `diag OTA err: ${String(e)}`;
  }

  const cargarMeseros = async () => {
    setLoadingMeseros(true);
    setMeserosError(null);
    if (!isSupabaseConfigured) {
      setMeserosError('Config de Supabase faltante en el build.');
      setLoadingMeseros(false);
      return;
    }
    try {
      // En gama baja / red intermitente la petición puede quedar colgada sin
      // resolver (RN no aplica timeout por defecto), dejando el spinner infinito.
      // Timeout de 8s vía Promise.race: si no responde, tiramos error y el finally
      // libera el loading para poder reintentar.
      const query = supabase
        .from('meseros')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre', { ascending: true })
        .returns<MeseroOption[]>();
      const { data, error: err } = (await Promise.race([
        query,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
      ])) as { data: MeseroOption[] | null; error: unknown };

      if (err) {
        setMeserosError('No se pudo cargar la lista de meseros.');
      } else {
        setMeseros(data ?? []);
      }
    } catch (e) {
      setMeserosError(
        (e as Error)?.message === 'timeout'
          ? 'La conexión tardó demasiado.'
          : 'No se pudo cargar la lista de meseros.',
      );
    } finally {
      setLoadingMeseros(false);
    }
  };

  useEffect(() => {
    cargarMeseros();
  }, []);

  const intentarLogin = async (force: boolean) => {
    setLoading(true);
    const res = await signIn(nombre, pin, { force });
    setLoading(false);
    if (!res.ok) {
      setError(res.error ?? 'No se pudo iniciar sesión.');
      setOtherDevice(!!res.otherDevice);
      // Si el bloqueo es por otro equipo, conservamos el PIN para el botón de
      // emergencia; en cualquier otro error lo limpiamos.
      if (!res.otherDevice) setPin('');
    }
  };

  const onSubmit = async () => {
    if (loading) return;
    setError(null);
    setOtherDevice(false);
    if (!nombre) {
      setError('Selecciona tu nombre.');
      return;
    }
    await intentarLogin(false);
  };

  // Salida de emergencia: toma el control aunque haya sesión en otro teléfono.
  const onForzarLogin = () => {
    if (loading) return;
    Alert.alert(
      'Iniciar sesión aquí',
      'Se cerrará la sesión en el otro teléfono. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, continuar',
          style: 'destructive',
          onPress: () => {
            setError(null);
            setOtherDevice(false);
            intentarLogin(true);
          },
        },
      ],
    );
  };

  const seleccionar = (m: MeseroOption) => {
    setNombre(m.nombre);
    setPickerOpen(false);
    setError(null);
    setTimeout(() => pinRef.current?.focus(), 200);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.logoWrap}>
          <Image
            source={require('../../assets/logo-zafari.png')}
            style={styles.logoImg}
            resizeMode="contain"
          />
          <Text style={styles.subtitle}>App de meseros</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Nombre</Text>
          <Pressable
            style={styles.selector}
            onPress={() => setPickerOpen(true)}
            disabled={loading}
          >
            <Text style={[styles.selectorText, !nombre && styles.selectorPlaceholder]}>
              {nombre || 'Selecciona tu nombre'}
            </Text>
            <Text style={styles.chevron}>▾</Text>
          </Pressable>
          {meserosError ? (
            <Pressable onPress={cargarMeseros}>
              <Text style={styles.reintentar}>{meserosError} Toca para reintentar.</Text>
            </Pressable>
          ) : null}

          <Text style={styles.label}>PIN (4 dígitos)</Text>
          <TextInput
            ref={pinRef}
            style={[styles.input, styles.pinInput]}
            value={pin}
            onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            returnKeyType="done"
            onSubmitEditing={onSubmit}
            editable={!loading}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [styles.boton, pressed && styles.botonPressed]}
            onPress={onSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.botonText}>Entrar</Text>
            )}
          </Pressable>

          {otherDevice ? (
            <Pressable style={styles.forzarBtn} onPress={onForzarLogin} disabled={loading}>
              <Text style={styles.forzarText}>Iniciar sesión aquí de todos modos</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>

      {/* Diagnóstico de errores de OTA (temporal) + versión de la app. */}
      <Text style={styles.otaErr}>{otaErrDiag}</Text>
      <Text style={styles.version}>{VERSION_TEXT}</Text>

      {/* Modal selector de nombre */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Elige tu nombre</Text>
            <Pressable onPress={cargarMeseros} hitSlop={8}>
              <Text style={styles.refresh}>↻</Text>
            </Pressable>
          </View>

          {loadingMeseros ? (
            <ActivityIndicator color="#D32F2F" style={{ paddingVertical: 30 }} />
          ) : meseros.length === 0 ? (
            <Text style={styles.vacio}>
              {meserosError ?? 'No hay meseros activos.'}
            </Text>
          ) : (
            <FlatList
              data={meseros}
              keyExtractor={(m) => String(m.id)}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <Pressable style={styles.opcion} onPress={() => seleccionar(item)}>
                  <Text style={styles.opcionText}>{item.nombre}</Text>
                </Pressable>
              )}
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  logoWrap: { alignItems: 'center', marginBottom: 40 },
  logoImg: { width: 180, height: 180, borderRadius: 24, backgroundColor: '#0d0d0d' },
  subtitle: { fontSize: 16, color: '#777', marginTop: 8 },
  form: { gap: 6 },
  label: { fontSize: 14, fontWeight: '700', color: '#444', marginTop: 12 },
  input: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    backgroundColor: '#fafafa',
  },
  selector: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fafafa',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorText: { fontSize: 18, color: '#1a1a1a' },
  selectorPlaceholder: { color: '#999' },
  chevron: { fontSize: 16, color: '#777' },
  reintentar: { color: '#D32F2F', fontSize: 13, marginTop: 6, fontWeight: '600' },
  pinInput: { letterSpacing: 8, fontSize: 24, textAlign: 'center' },
  error: { color: '#D32F2F', fontSize: 14, marginTop: 10, fontWeight: '600' },
  boton: {
    marginTop: 24,
    backgroundColor: '#D32F2F',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  botonPressed: { backgroundColor: '#B71C1C' },
  botonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  forzarBtn: {
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: '#D32F2F',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  forzarText: { color: '#D32F2F', fontSize: 15, fontWeight: '700' },
  version: {
    position: 'absolute',
    bottom: 34,
    alignSelf: 'center',
    fontSize: 11,
    color: '#333333',
  },
  otaErr: {
    position: 'absolute',
    bottom: 54,
    alignSelf: 'center',
    textAlign: 'center',
    fontSize: 10,
    color: '#B71C1C',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 34,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  refresh: { fontSize: 22, color: '#D32F2F' },
  vacio: { textAlign: 'center', color: '#999', paddingVertical: 30 },
  opcion: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  opcionText: { fontSize: 18, color: '#222' },
});
