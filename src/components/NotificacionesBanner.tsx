import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import { colors } from '../theme';
import { requestNotificationPermissions } from '../lib/notifications';

/**
 * Banner (tarjeta blanca) que invita a activar las notificaciones. Se oculta
 * solo cuando el permiso ya está concedido — igual que el portal web.
 */
export function NotificacionesBanner() {
  const [granted, setGranted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    notifee
      .getNotificationSettings()
      .then((s) => {
        if (!cancelled) setGranted(s.authorizationStatus >= AuthorizationStatus.AUTHORIZED);
      })
      .catch(() => {
        if (!cancelled) setGranted(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (granted !== false) return null;

  const activar = async () => {
    setBusy(true);
    const ok = await requestNotificationPermissions();
    setBusy(false);
    setGranted(ok);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.icon}>🔔</Text>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Activa las notificaciones</Text>
        <Text style={styles.sub}>Recibe alertas cuando llegue un llamado</Text>
      </View>
      <Pressable style={styles.btn} onPress={activar} disabled={busy}>
        <Text style={styles.btnText}>Activar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginTop: 12,
    gap: 12,
  },
  icon: { fontSize: 22 },
  textWrap: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '800' },
  sub: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  btn: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  btnText: { color: '#000', fontWeight: '800', fontSize: 14 },
});
