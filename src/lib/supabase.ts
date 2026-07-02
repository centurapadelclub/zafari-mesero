// Polyfill necesario para que supabase-js funcione en React Native
// (debe importarse ANTES de crear el cliente).
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

// Doble fuente para builds nativos:
//  1) process.env.EXPO_PUBLIC_* -> Metro los inyecta al bundle en tiempo de build.
//  2) Constants.expoConfig.extra -> los embebemos en el config (app.config.ts) en
//     tiempo de build; siempre disponibles en runtime aunque el inlining fallara.
const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string | null;
  supabaseAnonKey?: string | null;
};

const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const envKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabaseUrl = envUrl ?? extra.supabaseUrl ?? undefined;
const supabaseAnonKey = envKey ?? extra.supabaseAnonKey ?? undefined;

/** true si las credenciales llegaron al build por cualquiera de las dos vías. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/** De dónde salieron las credenciales (para el texto de diagnóstico del login). */
export const supabaseCredsSource: 'env' | 'extra' | 'ninguna' = envUrl
  ? 'env'
  : extra.supabaseUrl
    ? 'extra'
    : 'ninguna';

/** Primeros 20 caracteres de la URL en uso (para confirmar que llega al build). */
export const supabaseUrlPreview = supabaseUrl ? String(supabaseUrl).slice(0, 20) : '(vacío)';

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY en el bundle. ' +
      'En builds de EAS estas variables NO vienen del archivo .env (está gitignoreado): ' +
      'definilas en eas.json (build.<perfil>.env) o con `eas env`. Ver README.',
  );
}

// IMPORTANTE: usamos placeholders VÁLIDOS si faltan las credenciales para que
// createClient NO tire un error en tiempo de carga del módulo (eso crashearía la
// app con pantalla blanca antes de renderizar). Con credenciales faltantes, las
// requests fallan de forma controlada (no revientan la app).
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
  auth: {
    // Persistimos nuestra "sesión de mesero" manualmente (ver AuthContext);
    // no usamos Supabase Auth, así que desactivamos su manejo de sesión.
    storage: AsyncStorage,
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      // Limita la frecuencia de eventos realtime (eventos por segundo).
      eventsPerSecond: 10,
    },
  },
});
