import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

// ⚠️ Ajustar al número/link real de Pulso (el de la web).
const PULSO_WHATSAPP = 'https://wa.me/5490000000000';

export function PulsoFooter() {
  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => Linking.openURL(PULSO_WHATSAPP).catch(() => {})} hitSlop={8}>
        <Text style={styles.text}>
          Hecho por <Text style={styles.brand}>Pulso</Text>
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 12 },
  text: { color: colors.textMuted, fontSize: 12 },
  brand: { color: colors.gold, fontWeight: '800' },
});
