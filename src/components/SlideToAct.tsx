import React, { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';

interface Props {
  onAtender: () => void;
  onIgnorar: () => void;
}

const TRACK_WIDTH = 300;
const KNOB = 78;
const MAX = (TRACK_WIDTH - KNOB) / 2; // desplazamiento máximo a cada lado
const THRESHOLD = MAX * 0.7; // cuánto hay que deslizar para confirmar

/**
 * Botón circular deslizable estilo "llamada entrante".
 *  - deslizar a la DERECHA  → onAtender
 *  - deslizar a la IZQUIERDA → onIgnorar
 * Si no se supera el umbral, vuelve al centro.
 */
export function SlideToAct({ onAtender, onIgnorar }: Props) {
  const x = useRef(new Animated.Value(0)).current;
  const fired = useRef(false);

  const springBack = () => {
    Animated.spring(x, { toValue: 0, useNativeDriver: true, friction: 6 }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4,
      onPanResponderMove: (_, g) => {
        const clamped = Math.max(-MAX, Math.min(MAX, g.dx));
        x.setValue(clamped);
      },
      onPanResponderRelease: (_, g) => {
        if (fired.current) return;
        if (g.dx >= THRESHOLD) {
          fired.current = true;
          Animated.timing(x, { toValue: MAX, duration: 120, useNativeDriver: true }).start(() =>
            onAtender(),
          );
        } else if (g.dx <= -THRESHOLD) {
          fired.current = true;
          Animated.timing(x, { toValue: -MAX, duration: 120, useNativeDriver: true }).start(() =>
            onIgnorar(),
          );
        } else {
          springBack();
        }
      },
      onPanResponderTerminate: springBack,
    }),
  ).current;

  // Opacidad de las pistas según el sentido del deslizamiento.
  const atenderOpacity = x.interpolate({
    inputRange: [0, MAX],
    outputRange: [0.35, 1],
    extrapolate: 'clamp',
  });
  const ignorarOpacity = x.interpolate({
    inputRange: [-MAX, 0],
    outputRange: [1, 0.35],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        <Animated.Text style={[styles.sideLabel, styles.left, { opacity: ignorarOpacity }]}>
          ◀ Ignorar
        </Animated.Text>
        <Animated.Text style={[styles.sideLabel, styles.right, { opacity: atenderOpacity }]}>
          Atender ▶
        </Animated.Text>

        <Animated.View
          style={[styles.knob, { transform: [{ translateX: x }] }]}
          {...panResponder.panHandlers}
        >
          <Text style={styles.knobIcon}>☰</Text>
        </Animated.View>
      </View>
      <Text style={styles.hint}>Deslizá el botón</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  track: {
    width: TRACK_WIDTH,
    height: KNOB + 12,
    borderRadius: (KNOB + 12) / 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  sideLabel: { position: 'absolute', color: '#fff', fontWeight: '800', fontSize: 15 },
  left: { left: 18 },
  right: { right: 18 },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  knobIcon: { fontSize: 30, color: '#D32F2F', fontWeight: '900' },
  hint: { color: 'rgba(255,255,255,0.7)', marginTop: 14, fontSize: 13 },
});
