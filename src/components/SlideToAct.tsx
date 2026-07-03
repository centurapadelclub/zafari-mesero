import React, { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';

interface Props {
  onAtender: () => void;
  onIgnorar: () => void;
}

const GOLD = '#D4A017';
const TRACK_WIDTH = 330;
const KNOB = 90;
const MAX = (TRACK_WIDTH - KNOB) / 2; // desplazamiento máximo a cada lado
const THRESHOLD = MAX * 0.62; // cuánto hay que deslizar para confirmar
const KNOB_LEFT = (TRACK_WIDTH - KNOB) / 2;

/**
 * Botón deslizable estilo "llamada entrante" (referencia Zafari):
 *  - pista bicolor: rojo (IGNORAR) a la izquierda, verde (ATENDER) a la derecha
 *  - perilla blanca central con borde dorado e ícono de menú (☰)
 *  - deslizar a la DERECHA → onAtender ; a la IZQUIERDA → onIgnorar
 * Si no se supera el umbral, la perilla vuelve al centro.
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

  return (
    <View style={styles.wrap}>
      <View style={styles.pill}>
        <View style={styles.left}>
          <Text style={styles.hangup}>📞</Text>
          <Text style={styles.label}>IGNORAR</Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.label}>ATENDER</Text>
          <Text style={styles.play}>▶</Text>
        </View>
      </View>

      <Animated.View
        style={[styles.knob, { transform: [{ translateX: x }] }]}
        {...panResponder.panHandlers}
      >
        <Text style={styles.knobIcon}>☰</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: TRACK_WIDTH, height: KNOB + 10, justifyContent: 'center' },
  pill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    borderRadius: (KNOB + 10) / 2,
    borderWidth: 2,
    borderColor: GOLD,
    overflow: 'hidden',
  },
  left: {
    flex: 1,
    backgroundColor: '#8E1B1B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 22,
    gap: 10,
  },
  right: {
    flex: 1,
    backgroundColor: '#1E4A2B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 22,
    gap: 10,
  },
  label: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  hangup: { fontSize: 20, transform: [{ rotate: '135deg' }] },
  play: { color: '#7CE29A', fontSize: 18 },
  knob: {
    position: 'absolute',
    left: KNOB_LEFT,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: GOLD,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: GOLD,
    shadowOpacity: 0.8,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  knobIcon: { fontSize: 30, color: GOLD, fontWeight: '900' },
});
