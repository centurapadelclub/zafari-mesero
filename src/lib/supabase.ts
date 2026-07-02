// Polyfill necesario para que supabase-js funcione en React Native
// (debe importarse ANTES de crear el cliente).
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** true si las credenciales llegaron al bundle (variables EXPO_PUBLIC_*). */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

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
