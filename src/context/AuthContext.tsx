import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import {
  deletePushToken,
  savePushToken,
  startForegroundService,
  stopForegroundService,
} from '../lib/notifications';
import { Id, Mesero } from '../types/db';
import { SESSION_STORAGE_KEY, getDeviceId } from '../lib/session';

/** Ventana tras la cual una sesión sin heartbeat se considera caducada (12 h). */
const SESSION_STALE_MS = 12 * 60 * 60 * 1000;

/** Envuelve una promesa con timeout para que la red lenta no cuelgue el login. */
function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    p as Promise<T>,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

// Posibles nombres de la columna con el nombre de la zona (por si no es 'nombre').
const ZONA_NAME_FIELDS = ['nombre', 'name', 'nombre_zona', 'zona', 'titulo', 'descripcion', 'label'];

/** Extrae el nombre de una fila de `zonas` probando varias columnas posibles. */
function zonaNombre(z: Record<string, unknown>): string | null {
  for (const f of ZONA_NAME_FIELDS) {
    const v = z[f];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/** Datos de la sesión del mesero que persistimos localmente. */
export interface MeseroSession {
  id: Id;
  nombre: string;
  rol?: string | null;
  zonaIds: Id[]; // ids de zonas asignadas (asignaciones.zona_id)
  zonas: string[]; // nombres de esas zonas (zonas.nombre) — se usan para filtrar el feed
}

interface SignInResult {
  ok: boolean;
  error?: string;
  otherDevice?: boolean; // true = bloqueado por sesión activa en otro equipo
}

interface AuthState {
  session: MeseroSession | null;
  loading: boolean;
  signIn: (nombre: string, pin: string, opts?: { force?: boolean }) => Promise<SignInResult>;
  signOut: () => Promise<void>;
}

const STORAGE_KEY = SESSION_STORAGE_KEY;

const AuthContext = createContext<AuthState | undefined>(undefined);

/**
 * Resuelve las zonas de un mesero: asignaciones.zona_id  →  zonas.nombre.
 * 1) asignaciones WHERE mesero_id = <id>  → lista de zona_id
 * 2) zonas WHERE id IN (zona_ids)         → lista de nombre
 * Los NOMBRES son los que van a session.zonas (para filtrar por ubicacion).
 * Loguea los errores (antes se ignoraban silenciosamente).
 */
async function resolveZonasForMesero(meseroId: Id): Promise<{ zonaIds: Id[]; zonas: string[] }> {
  // OJO: pedimos SOLO zona_id. La tabla asignaciones NO tiene columna `id`, así
  // que pedir `id` hacía fallar la query (devolvía vacío → session.zonas quedaba []).
  const { data: asignaciones, error: aErr } = await supabase
    .from('asignaciones')
    .select('zona_id')
    .eq('mesero_id', meseroId)
    .returns<{ zona_id: Id }[]>();
  if (aErr) {
    // eslint-disable-next-line no-console
    console.warn('[auth] error consultando asignaciones:', aErr.message);
  }

  const zonaIds = Array.from(
    new Set((asignaciones ?? []).map((a) => a.zona_id).filter((v) => v != null)),
  );

  let zonas: string[] = [];
  if (zonaIds.length) {
    // select('*') para no depender del nombre exacto de la columna del nombre.
    const { data: zonasRows, error: zErr } = await supabase
      .from('zonas')
      .select('*')
      .in('id', zonaIds)
      .returns<Record<string, unknown>[]>();
    if (zErr) {
      // eslint-disable-next-line no-console
      console.warn('[auth] error consultando zonas por id:', zErr.message);
    }
    // eslint-disable-next-line no-console
    console.log('[auth] zonas RAW:', JSON.stringify(zonasRows));
    zonas = (zonasRows ?? []).map(zonaNombre).filter((v): v is string => Boolean(v));
  }

  // eslint-disable-next-line no-console
  console.log('[auth] zona_ids:', JSON.stringify(zonaIds), '-> se guardará en session.zonas:', JSON.stringify(zonas));
  return { zonaIds, zonas };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<MeseroSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setSession(JSON.parse(raw) as MeseroSession);
      } catch {
        // arrancamos sin sesión
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Registrar/actualizar el token FCM cuando hay un mesero logueado. Corre en CADA
  // arranque con sesión (login y restauración al reabrir la app), no solo en el
  // login: si el registro falló antes (permiso no concedido aún, sin red, Play
  // Services lento) esto lo reintenta. El upsert por onConflict 'token' es
  // idempotente. No bloqueante y con catch para no frenar el arranque.
  useEffect(() => {
    if (session?.id == null) return;
    savePushToken(session.id).catch(() => {
      // el error ya se registra en setPushDiag dentro de savePushToken
    });
    // Heartbeat: refrescar session_at en cada arranque con sesión, SOLO si este
    // equipo sigue siendo el dueño. Así una sesión en uso no caduca (12 h), pero
    // una abandonada sí. No bloqueante y con catch.
    (async () => {
      try {
        const deviceId = await getDeviceId();
        await supabase
          .from('meseros')
          .update({ session_at: new Date().toISOString() })
          .eq('id', session.id)
          .eq('session_device_id', deviceId);
      } catch {
        // ignorar: el heartbeat es best-effort
      }
    })();
    // Foreground Service: mantener el proceso vivo para recibir llamados aunque
    // la app esté en segundo plano (estilo WhatsApp). Delay de 500 ms para dar
    // tiempo a que notifee termine de inicializarse antes de arrancar el service.
    const t = setTimeout(() => {
      startForegroundService();
    }, 500);
    return () => clearTimeout(t);
  }, [session?.id]);

  // Recalcular las zonas cada vez que hay sesión (login o restauración). Así, si
  // una sesión quedó cacheada con zonas: [] (de un login previo o por un error
  // transitorio), se auto-corrige al reabrir la app SIN necesidad de re-login.
  useEffect(() => {
    const mid = session?.id;
    if (mid == null) return;
    let cancelled = false;
    (async () => {
      const { zonaIds, zonas } = await resolveZonasForMesero(mid);
      if (cancelled) return;
      setSession((prev) => {
        if (!prev || prev.id !== mid) return prev;
        const changed =
          prev.zonas.join('|') !== zonas.join('|') || prev.zonaIds.length !== zonaIds.length;
        if (!changed) return prev;
        const updated = { ...prev, zonaIds, zonas };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.id]);

  const signIn = useCallback(
    async (nombre: string, pin: string, opts?: { force?: boolean }): Promise<SignInResult> => {
      const nombreLimpio = nombre.trim();
      if (!nombreLimpio) return { ok: false, error: 'Ingresa tu nombre.' };
      if (!/^\d{4}$/.test(pin)) return { ok: false, error: 'El PIN debe tener 4 dígitos.' };

      try {
        // 1) Validar contra `meseros` (nombre + pin). Con timeout para no colgar.
        const { data: meseros, error } = await withTimeout(
          supabase
            .from('meseros')
            .select('id, nombre, pin, rol, activo, session_device_id, session_at')
            .ilike('nombre', nombreLimpio)
            .eq('pin', pin)
            .limit(1)
            .returns<Mesero[]>(),
          8000,
        );

        if (error) {
          return { ok: false, error: 'No se pudo conectar con el servidor.' };
        }
        const mesero = meseros?.[0];
        if (!mesero) return { ok: false, error: 'Nombre o PIN incorrecto.' };
        if (mesero.activo === false) {
          return { ok: false, error: 'Tu usuario está inactivo. Habla con el encargado.' };
        }

        // 2) Una sesión por equipo: comparar el dispositivo actual con el que tiene
        //    la sesión activa del mesero.
        const deviceId = await getDeviceId();
        const otroEquipo =
          !!mesero.session_device_id && mesero.session_device_id !== deviceId;
        if (otroEquipo && !opts?.force) {
          const sessionAt = mesero.session_at ? Date.parse(mesero.session_at) : 0;
          const vigente = Number.isFinite(sessionAt) && Date.now() - sessionAt < SESSION_STALE_MS;
          if (vigente) {
            // Sesión activa reciente en otro teléfono → bloquear (con salida de
            // emergencia: el llamador puede reintentar con force).
            return { ok: false, error: 'Sesión activa en otro teléfono', otherDevice: true };
          }
          // Sesión caducada (> 12 h sin heartbeat) → tomamos el control.
        }

        // 3) Zonas asignadas: asignaciones.zona_id → zonas.nombre
        const { zonaIds, zonas } = await resolveZonasForMesero(mesero.id);

        // 4) Reclamar la sesión para ESTE equipo (session_device_id + session_at).
        try {
          await withTimeout(
            supabase
              .from('meseros')
              .update({ session_device_id: deviceId, session_at: new Date().toISOString() })
              .eq('id', mesero.id),
            8000,
          );
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[auth] no se pudo reclamar la sesión:', e);
        }

        const newSession: MeseroSession = {
          id: mesero.id,
          nombre: mesero.nombre,
          rol: mesero.rol ?? null,
          zonaIds,
          zonas,
        };
        setSession(newSession);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error:
            (e as Error)?.message === 'timeout'
              ? 'La conexión tardó demasiado. Intenta de nuevo.'
              : 'No se pudo conectar con el servidor.',
        };
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    // Detener el Foreground Service: deslogueado no debe quedar corriendo.
    await stopForegroundService();
    // Esc1: borrar el token de este dispositivo para que no le lleguen más
    // notificaciones. SÍ esperamos el borrado (el DELETE a Supabase es rápido y
    // debe completarse, si no queda un token huérfano recibiendo pushes), pero
    // con un techo de 3s vía Promise.race para que el logout nunca se cuelgue.
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const prev = JSON.parse(raw) as MeseroSession;
        // Liberar la sesión de una-por-equipo: poner en null session_device_id/at,
        // SOLO si el equipo con la sesión sigue siendo este (para no pisar una
        // sesión que otro teléfono ya tomó). Con timeout para no colgar el logout.
        const deviceId = await getDeviceId();
        await Promise.race([
          Promise.all([
            deletePushToken(prev.id).catch(() => {}),
            (async () => {
              try {
                await supabase
                  .from('meseros')
                  .update({ session_device_id: null, session_at: null })
                  .eq('id', prev.id)
                  .eq('session_device_id', deviceId);
              } catch {
                // best-effort: si falla, la sesión caduca sola a las 12 h
              }
            })(),
          ]),
          new Promise((resolve) => setTimeout(resolve, 3000)),
        ]);
      } catch {
        // ignorar
      }
    }
    setSession(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ session, loading, signIn, signOut }),
    [session, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
