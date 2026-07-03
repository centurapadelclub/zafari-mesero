import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const PULSO_WHATSAPP = 'https://wa.me/526865476589';

export function PulsoFooter() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>SISTEMA DESARROLLADO POR</Text>
      <Pressable onPress={() => Linking.openURL(PULSO_WHATSAPP).catch(() => {})} hitSlop={8}>
        <Text style={styles.brand}>Pulso</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 20, gap: 2 },
  label: { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  brand: { color: colors.gold, fontSize: 16, fontWeight: '900' },
});
