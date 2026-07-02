import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

interface Props {
  children: React.ReactNode;
}
interface State {
  error: Error | null;
  info: string | null;
}

/**
 * Error boundary raíz: si algo en el árbol de React tira un error al renderizar,
 * en vez de pantalla blanca / cierre, muestra el error y el stack en pantalla.
 *
 * OJO: solo atrapa errores DENTRO del render de React. Los errores en tiempo de
 * carga de módulos (imports con efectos secundarios, p. ej. createClient de
 * Supabase o un módulo nativo al importarse) ocurren ANTES y no se atrapan acá;
 * para esos ver los try-catch en index.ts y supabase.ts.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
    this.setState({ info: info.componentStack });
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>⚠️ La app tuvo un error al iniciar</Text>
        <Text style={styles.subtitle}>Mostrá esta pantalla al equipo técnico.</Text>

        <Text style={styles.label}>Error</Text>
        <Text style={styles.mono}>{error.name}: {error.message}</Text>

        {error.stack ? (
          <>
            <Text style={styles.label}>Stack</Text>
            <Text style={styles.mono}>{error.stack}</Text>
          </>
        ) : null}

        {info ? (
          <>
            <Text style={styles.label}>Componentes</Text>
            <Text style={styles.mono}>{info}</Text>
          </>
        ) : null}
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
  content: { padding: 20, paddingTop: 60 },
  title: { color: '#ff5252', fontSize: 20, fontWeight: '800' },
  subtitle: { color: '#bbb', fontSize: 14, marginTop: 4, marginBottom: 16 },
  label: { color: '#ffb300', fontSize: 13, fontWeight: '800', marginTop: 16, marginBottom: 4 },
  mono: {
    color: '#eee',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
