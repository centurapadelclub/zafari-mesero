import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

interface Props {
  /** Momento de inicio (created_at del llamado) en ISO. */
  desde: string;
}

function format(elapsedMs: number): string {
  const totalSec = Math.max(0, Math.floor(elapsedMs / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Cronómetro que muestra el tiempo transcurrido desde `desde`, actualizándose
 * cada segundo. Cambia de color según la urgencia (>2 min ámbar, >5 min rojo).
 */
export function Cronometro({ desde }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const start = new Date(desde).getTime();
  const elapsed = now - start;
  const min = elapsed / 60000;

  const color = min >= 5 ? '#D32F2F' : min >= 2 ? '#F57C00' : '#2E7D32';

  return <Text style={[styles.text, { color }]}>{format(elapsed)}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
