import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  Pressable,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import notifee from '@notifee/react-native';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { SlideToAct } from '../components/SlideToAct';
import { startCallVibration, stopCallVibration } from '../lib/notifications';
import { scheduleSnooze, clearPendingIncomingCall } from '../lib/incomingCall';
import { subscribeCallResolved } from '../lib/callResolution';
import { setShowWhenLocked } from '../../modules/lock-screen';
import { getSoundPref, getTonePref, TonePref } from '../lib/preferences';
import { money } from '../lib/money';
import {
  LLAMADO_ATENDIDO,
  LLAMADO_PENDIENTE,
  PEDIDO_ESTADO_AL_ATENDER,
  PEDIDO_PENDIENTE,
  RootStackParamList,
} from '../types/db';

const RINGTONE = require('../../assets/ringtone.wav');
const LOGO = require('../../assets/logo-zafari.png');
const GOLD = '#D4A017';

/** Cada tono seleccionable mapea a un .wav en assets/. */
const TONE_SOURCES: Record<TonePref, ReturnType<typeof require>> = {
  suave: require('../../assets/notif-suave.wav'),
  timbre: RINGTONE,
  alarma: require('../../assets/alarma.wav'),
};

interface PedidoResumen {
  cliente?: string | null;
  telefono?: string | null;
  total?: number | null;
  items: { cantidad: number; nombre: string; subtotal?: number | null }[];
}

type IncomingRoute = RouteProp<RootStackParamList, 'IncomingCall'>;

/**
 * Escenario 2: pantalla estilo "llamada entrante" que se muestra a pantalla
 * completa (la lanza el Full Screen Intent de notifee cuando el celular está
 * bloqueado / pantalla apagada).
 */
export function IncomingCallScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<IncomingRoute>();
  const { session } = useAuth();
  const { kind, id, ubicacion, tipo } = params;
  const esPedido = kind === 'pedido';
  const [busy, setBusy] = useState(false);
  const [pedido, setPedido] = useState<PedidoResumen | null>(null);

  // Ringtone en loop mientras la pantalla esté visible (solo si la preferencia
  // es 'sonido + vibración'). La vibración va siempre. El tono depende de la
  // preferencia guardada (suave / timbre / alarma).
  const player = useAudioPlayer(RINGTONE);

  // true = esta pantalla se está resolviendo por MI propia acción (atender), para
  // NO mostrar "Atendido por otro mesero" cuando llegue el evento de realtime que
  // dispara mi propio UPDATE.
  const resolvingSelfRef = useRef(false);
  // Evita cerrar dos veces (realtime + chequeo de foreground pueden coincidir).
  const closedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    startCallVibration();
    // SOLO durante esta pantalla: mostrar sobre el bloqueo + encender pantalla.
    setShowWhenLocked(true);
    (async () => {
      try {
        const [pref, tono] = await Promise.all([getSoundPref(), getTonePref()]);
        if (cancelled || pref !== 'sound_vibration') return;
        // Sonar aunque el celular esté en silencio.
        await setAudioModeAsync({ playsInSilentMode: true });
        player.replace(TONE_SOURCES[tono]); // aplica el tono elegido
        player.loop = true;
        player.play();
      } catch {
        // sin audio: la vibración sigue funcionando
      }
    })();

    return () => {
      cancelled = true;
      stopCallVibration();
      // Restaurar comportamiento normal: la app vuelve a respetar el bloqueo.
      setShowWhenLocked(false);
      try {
        player.pause();
      } catch {
        // el player puede haberse liberado al desmontar
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si es un PEDIDO, traemos el resumen (cliente, total, primeros items).
  useEffect(() => {
    if (!esPedido) return;
    let cancelled = false;
    (async () => {
      const { data: ped } = await supabase
        .from('pedidos')
        .select('nombre_cliente, telefono_cliente, total')
        .eq('id', id)
        .maybeSingle();
      const { data: items } = await supabase
        .from('pedido_items')
        .select('nombre_producto, cantidad, subtotal')
        .eq('pedido_id', id)
        .limit(4);
      if (cancelled) return;
      setPedido({
        cliente: ped?.nombre_cliente ?? null,
        telefono: ped?.telefono_cliente ?? null,
        total: ped?.total ?? null,
        items: (items ?? []).map((r) => ({
          cantidad: Number(r.cantidad) || 1,
          nombre: r.nombre_producto != null ? String(r.nombre_producto) : '(item)',
          subtotal: r.subtotal != null ? Number(r.subtotal) : null,
        })),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [esPedido, id]);

  const stopRingtone = () => {
    try {
      player.pause();
    } catch {
      // ignorar
    }
  };

  /** Restaura el comportamiento normal ante el bloqueo. Se llama EXPLÍCITAMENTE en
   *  cada camino de salida porque cuando IncomingCall es la ruta inicial (cold
   *  start), navegar a 'Tabs' la deja MONTADA debajo → el cleanup del useEffect
   *  NO corre. Sin esto, con showWhenLocked activado siempre en onCreate, la app
   *  quedaría visible sobre el bloqueo permanentemente. */
  const releaseLockScreen = () => {
    try {
      setShowWhenLocked(false);
    } catch {
      // el módulo nativo puede no estar disponible
    }
  };

  const cerrar = () => {
    if (closedRef.current) return; // ya se cerró (evita doble cierre)
    closedRef.current = true;
    releaseLockScreen();
    // Borrar la llamada pendiente del storage para no reabrirla en el próximo
    // arranque (ya la atendimos/ignoramos).
    clearPendingIncomingCall();
    stopCallVibration();
    stopRingtone();
    notifee.cancelAllNotifications().catch(() => {});
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Tabs');
  };

  /** Cierre disparado porque OTRO mesero atendió (realtime). Mismo cleanup que
   *  cerrar() + un aviso breve. La vibración y el ringtone se detienen en cerrar. */
  const cerrarPorOtro = () => {
    if (closedRef.current) return;
    try {
      ToastAndroid.show('Atendido por otro mesero', ToastAndroid.SHORT);
    } catch {
      // ToastAndroid solo existe en Android; si falla, cerramos igual.
    }
    cerrar();
  };

  /** Chequea en el server si este llamado/pedido ya dejó de estar pendiente (p. ej.
   *  se atendió mientras estábamos en background y se perdió el evento realtime).
   *  Solo cierra ante confirmación; sin red no hace nada. */
  const checkResolved = async () => {
    if (closedRef.current || resolvingSelfRef.current) return;
    try {
      const table = esPedido ? 'pedidos' : 'llamados';
      const { data } = await supabase.from(table).select('estado').eq('id', id).maybeSingle();
      const estado = String((data as { estado?: unknown } | null)?.estado ?? '');
      const pendiente = esPedido ? PEDIDO_PENDIENTE : LLAMADO_PENDIENTE;
      if (estado && estado !== pendiente) cerrarPorOtro();
    } catch {
      // sin red / error: NO cerramos (podría seguir pendiente)
    }
  };

  // Cierre automático si OTRO mesero atiende ESTE mismo llamado/pedido.
  useEffect(() => {
    // 1) Evento de realtime (watcher global) para este kind+id.
    const unsub = subscribeCallResolved((rKind, rId) => {
      if (rKind === kind && String(rId) === String(id)) cerrarPorOtro();
    });
    // 2) Chequeo al montar: pudo haberse atendido ANTES de que abriéramos.
    checkResolved();
    // 3) Al volver a foreground: el evento de realtime pudo perderse mientras la
    //    app estaba en background (caso pantalla sobre el bloqueo).
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') checkResolved();
    });
    return () => {
      unsub();
      appSub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Snooze 30 s: reprograma la MISMA llamada y cierra la pantalla. */
  const onSnooze = async () => {
    try {
      await scheduleSnooze({ kind, id: String(id), ubicacion, tipo });
    } catch {
      // si no se pudo programar, igual cerramos
    }
    cerrar();
  };

  /** "Ver pedido": cierra y abre el detalle de ese pedido en la pestaña Pedidos. */
  const verPedido = () => {
    releaseLockScreen();
    clearPendingIncomingCall();
    stopCallVibration();
    stopRingtone();
    notifee.cancelAllNotifications().catch(() => {});
    navigation.navigate('Tabs', { tab: 'pedidos', openPedidoId: id });
  };

  const onAtender = async () => {
    if (busy) return;
    setBusy(true);
    // Mi propia acción: al llegar el evento realtime de MI update, no mostrar
    // "Atendido por otro mesero".
    resolvingSelfRef.current = true;
    // Detener sonido/vibración YA (antes del update): si el update se cuelga, al
    // menos deja de sonar de inmediato.
    stopCallVibration();
    stopRingtone();
    const table = kind === 'llamado' ? 'llamados' : 'pedidos';
    const nuevoEstado = kind === 'llamado' ? LLAMADO_ATENDIDO : PEDIDO_ESTADO_AL_ATENDER;
    try {
      // Timeout de 6s: en gama baja la petición puede quedar colgada y sin esto el
      // spinner nunca terminaba. .select('id') para saber si tocó la fila.
      const { data, error } = (await Promise.race([
        supabase
          .from(table)
          .update({
            estado: nuevoEstado,
            atendido_at: new Date().toISOString(),
            mesero_id: session?.id ?? null,
          })
          .eq('id', id)
          .select('id'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000)),
      ])) as { data: unknown[] | null; error: { message: string } | null };
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[IncomingCall] atender error:', error.message);
      } else if ((data?.length ?? 0) === 0) {
        // 0 filas sin error = la policy RLS de UPDATE bloqueó el cambio.
        // eslint-disable-next-line no-console
        console.warn(`[IncomingCall] atender tocó 0 filas (¿RLS UPDATE en "${table}"?)`);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[IncomingCall] atender timeout/excepción:', e);
    } finally {
      // Pase lo que pase: liberar el spinner y cerrar (no congelar la UI). Si el
      // update falló, el realtime/refetch corregirá el estado.
      setBusy(false);
      cerrar();
    }
  };

  const esLlamado = kind === 'llamado';
  const badge = esLlamado ? 'LLAMADO' : 'PEDIDO';
  const subtitulo = tipo || (esLlamado ? 'mesero' : 'nuevo pedido');
  const icono = esLlamado ? '🛎️' : '🍽️';

  return (
    <View style={styles.container}>
      {/* Bokeh / luces desenfocadas de fondo */}
      <View style={[styles.bokeh, styles.bokeh1]} />
      <View style={[styles.bokeh, styles.bokeh2]} />
      <View style={[styles.bokeh, styles.bokeh3]} />

      <SafeAreaView style={styles.safe}>
        {/* Header: logo + marca + badge */}
        <View style={styles.top}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={styles.marca}>ZAFARI</Text>
          <Text style={styles.submarca}>RESTAURANTE BAR</Text>

          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>{esPedido ? '📝' : '📞'}</Text>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
          <Text style={styles.subtitulo}>{subtitulo}</Text>
        </View>

        {/* Centro */}
        {esPedido ? (
          <View style={styles.middle}>
            <Text style={styles.label}>Nuevo pedido en</Text>
            <Text style={styles.ubicacion}>{ubicacion}</Text>
            <View style={styles.divider} />

            <View style={styles.pedidoCard}>
              {pedido?.cliente ? (
                <Text style={styles.pedidoCliente}>👤 {pedido.cliente}</Text>
              ) : null}
              {pedido?.items.length ? (
                pedido.items.map((it, i) => (
                  <View key={i} style={styles.pedidoItemRow}>
                    <Text style={styles.pedidoItem}>
                      <Text style={styles.pedidoQty}>{it.cantidad}x </Text>
                      {it.nombre}
                    </Text>
                    {it.subtotal != null ? (
                      <Text style={styles.pedidoItemPrecio}>{money(it.subtotal)}</Text>
                    ) : null}
                  </View>
                ))
              ) : (
                <Text style={styles.pedidoDim}>Cargando detalle…</Text>
              )}
              {pedido?.total != null ? (
                <View style={styles.pedidoTotalRow}>
                  <Text style={styles.pedidoTotalLabel}>TOTAL</Text>
                  <Text style={styles.pedidoTotalValue}>{money(pedido.total)}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.middle}>
            <View style={styles.glow}>
              <View style={styles.circle}>
                <Text style={styles.circleIcon}>{icono}</Text>
              </View>
            </View>

            <Text style={styles.label}>Te llaman de</Text>
            <Text style={styles.ubicacion}>{ubicacion}</Text>
            <View style={styles.divider} />
          </View>
        )}

        {/* Abajo: acciones */}
        <View style={styles.bottom}>
          {busy ? (
            <ActivityIndicator color={GOLD} size="large" />
          ) : esPedido ? (
            <>
              <Pressable style={styles.verPedidoBtn} onPress={verPedido}>
                <Text style={styles.verPedidoText}>Ver pedido ▶</Text>
              </Pressable>
              <Pressable style={styles.snoozeBtn} onPress={onSnooze}>
                <Text style={styles.snoozeText}>⏰ Snooze 30s</Text>
              </Pressable>
            </>
          ) : (
            <>
              <SlideToAct onAtender={onAtender} onSnooze={onSnooze} />
              <Text style={styles.hintIcon}>👆</Text>
              <Text style={styles.hint}>‹‹  Desliza el botón para atender  ››</Text>
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1a0d' },
  safe: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 24,
  },
  // Luces bokeh de fondo (verde/dorado muy tenue)
  bokeh: { position: 'absolute', borderRadius: 999 },
  bokeh1: {
    width: 220,
    height: 220,
    backgroundColor: 'rgba(212,160,23,0.05)',
    top: -40,
    left: -60,
  },
  bokeh2: {
    width: 260,
    height: 260,
    backgroundColor: 'rgba(212,160,23,0.06)',
    bottom: 40,
    right: -80,
  },
  bokeh3: {
    width: 160,
    height: 160,
    backgroundColor: 'rgba(124,226,154,0.04)',
    bottom: -30,
    left: -30,
  },
  top: { alignItems: 'center' },
  logo: { width: 96, height: 96 },
  marca: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 4, marginTop: 4 },
  submarca: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 7,
    marginTop: 18,
  },
  badgeIcon: { fontSize: 14 },
  badgeText: { color: GOLD, fontSize: 15, fontWeight: '900', letterSpacing: 2 },
  subtitulo: { color: 'rgba(255,255,255,0.85)', fontSize: 16, marginTop: 10 },
  middle: { alignItems: 'center' },
  glow: {
    width: 210,
    height: 210,
    borderRadius: 105,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: GOLD,
    backgroundColor: 'rgba(212,160,23,0.04)',
    shadowColor: GOLD,
    shadowOpacity: 0.9,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
  circle: {
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: '#12281a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleIcon: { fontSize: 76 },
  label: { color: 'rgba(255,255,255,0.85)', fontSize: 18, marginTop: 26 },
  ubicacion: {
    color: '#fff',
    fontSize: 54,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 6,
    letterSpacing: 1,
  },
  divider: { width: 200, height: 2, backgroundColor: GOLD, borderRadius: 1, marginTop: 14, opacity: 0.9 },
  bottom: { alignItems: 'center', alignSelf: 'stretch' },
  hintIcon: { fontSize: 20, marginTop: 16 },
  hint: { color: 'rgba(255,255,255,0.65)', fontSize: 14, marginTop: 6, letterSpacing: 0.5 },
  // --- Resumen de pedido ---
  pedidoCard: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.4)',
    borderRadius: 16,
    padding: 16,
    marginTop: 18,
    gap: 8,
  },
  pedidoCliente: { color: 'rgba(255,255,255,0.9)', fontSize: 15, marginBottom: 2 },
  pedidoItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  pedidoItem: { color: '#fff', fontSize: 15, flex: 1 },
  pedidoQty: { color: GOLD, fontWeight: '900' },
  pedidoItemPrecio: { color: GOLD, fontSize: 15, fontWeight: '700' },
  pedidoDim: { color: 'rgba(255,255,255,0.6)', fontSize: 14, paddingVertical: 8, textAlign: 'center' },
  pedidoTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    paddingTop: 10,
    marginTop: 4,
  },
  pedidoTotalLabel: { color: GOLD, fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  pedidoTotalValue: { color: GOLD, fontSize: 20, fontWeight: '900' },
  verPedidoBtn: {
    alignSelf: 'stretch',
    backgroundColor: '#1E7A3D',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  verPedidoText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  snoozeBtn: {
    alignSelf: 'stretch',
    borderWidth: 1.5,
    borderColor: GOLD,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 12,
  },
  snoozeText: { color: GOLD, fontSize: 16, fontWeight: '800' },
});
