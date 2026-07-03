import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextStyle } from 'react-native';
import { colors } from '../theme';
import { duracion } from '../lib/fecha';

interface Props {
  /** Momento de inicio (created_at) en ISO. */
  desde: string;
  /** Color del texto (por defecto dorado, igual que la web). */
  color?: string;
  style?: TextStyle;
}

/**
 * Cronómetro en vivo: muestra el tiempo transcurrido desde `desde` en MM:SS,
 * actualizándose cada segundo. En la web se ve dorado y sin cambiar de color.
 */
export function Cronometro({ desde, color = colors.gold, style }: Props) {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return <Text style={[styles.text, { color }, style]}>{duracion(desde)}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
