import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { Asignacion, Id, Mesero, Zona } from '../types/db';

/** Datos de la sesión del mesero que persistimos localmente. */
export interface MeseroSession {
  id: Id;
  nombre: string;
  rol?: string | null;
  zonaIds: Id[]; // ids de zonas asignadas (asignaciones.zona_id)
  zonas: string[]; // nombres de esas zonas (zonas.nombre) — se usan para filtrar el feed
}

interface AuthState {
  session: MeseroSession | null;
  loading: boolean;
  signIn: (nombre: string, pin: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const STORAGE_KEY = 'zafari.mesero.session';

const AuthContext = createContext<AuthState | undefined>(undefined);

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

  const signIn = useCallback(async (nombre: string, pin: string) => {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) return { ok: false, error: 'Ingresá tu nombre.' };
    if (!/^\d{4}$/.test(pin)) return { ok: false, error: 'El PIN debe tener 4 dígitos.' };

    // 1) Validar contra `meseros` (nombre + pin).
    const { data: meseros, error } = await supabase
      .from('meseros')
      .select('id, nombre, pin, rol, activo')
      .ilike('nombre', nombreLimpio)
      .eq('pin', pin)
      .limit(1)
      .returns<Mesero[]>();

    if (error) {
      return { ok: false, error: 'No se pudo conectar con el servidor.' };
    }
    const mesero = meseros?.[0];
    if (!mesero) return { ok: false, error: 'Nombre o PIN incorrecto.' };
    if (mesero.activo === false) {
      return { ok: false, error: 'Tu usuario está inactivo. Hablá con el encargado.' };
    }

    // 2) Zonas asignadas: asignaciones.zona_id  →  zonas.nombre
    const { data: asignaciones } = await supabase
      .from('asignaciones')
      .select('id, zona_id, mesero_id')
      .eq('mesero_id', mesero.id)
      .returns<Asignacion[]>();

    const zonaIds = Array.from(
      new Set((asignaciones ?? []).map((a) => a.zona_id).filter((v) => v != null)),
    );

    let zonas: string[] = [];
    if (zonaIds.length) {
      const { data: zonasRows } = await supabase
        .from('zonas')
        .select('id, nombre')
        .in('id', zonaIds)
        .returns<Zona[]>();
      zonas = (zonasRows ?? []).map((z) => z.nombre).filter(Boolean);
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
  }, []);

  const signOut = useCallback(async () => {
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
