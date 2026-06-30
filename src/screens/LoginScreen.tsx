import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

export function LoginScreen() {
  const { signIn } = useAuth();
  const [nombre, setNombre] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pinRef = useRef<TextInput>(null);

  const onSubmit = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    const res = await signIn(nombre, pin);
    setLoading(false);
    if (!res.ok) {
      setError(res.error ?? 'No se pudo iniciar sesión.');
      setPin('');
    }
    // Si ok, el RootNavigator cambia de pantalla automáticamente.
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
          <TextInput
            style={styles.input}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Tu nombre"
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => pinRef.current?.focus()}
            editable={!loading}
          />

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
});
