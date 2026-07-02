import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
  const pinRef = useRef<TextInput>(null);

  // Selector de nombre (meseros activos desde Supabase)
  const [meseros, setMeseros] = useState<MeseroOption[]>([]);
  const [loadingMeseros, setLoadingMeseros] = useState(true);
  const [meserosError, setMeserosError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const cargarMeseros = async () => {
    setLoadingMeseros(true);
    setMeserosError(null);
    if (!isSupabaseConfigured) {
      setMeserosError('Config de Supabase faltante en el build.');
      setLoadingMeseros(false);
      return;
    }
    const { data, error: err } = await supabase
      .from('meseros')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre', { ascending: true })
      .returns<MeseroOption[]>();

    if (err) {
      setMeserosError('No se pudo cargar la lista de meseros.');
    } else {
      setMeseros(data ?? []);
    }
    setLoadingMeseros(false);
  };

  useEffect(() => {
    cargarMeseros();
  }, []);

  const onSubmit = async () => {
    if (loading) return;
    setError(null);
    if (!nombre) {
      setError('Seleccioná tu nombre.');
      return;
    }
    setLoading(true);
    const res = await signIn(nombre, pin);
    setLoading(false);
    if (!res.ok) {
      setError(res.error ?? 'No se pudo iniciar sesión.');
      setPin('');
    }
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
          <Text style={styles.logo}>Zafari</Text>
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
              {nombre || 'Seleccioná tu nombre'}
            </Text>
            <Text style={styles.chevron}>▾</Text>
          </Pressable>
          {meserosError ? (
            <Pressable onPress={cargarMeseros}>
              <Text style={styles.reintentar}>{meserosError} Tocá para reintentar.</Text>
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
        </View>
      </KeyboardAvoidingView>

      {/* Modal selector de nombre */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Elegí tu nombre</Text>
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
  logo: { fontSize: 44, fontWeight: '900', color: '#D32F2F', letterSpacing: 1 },
  subtitle: { fontSize: 16, color: '#777', marginTop: 4 },
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
