// Polyfill necesario para que supabase-js funcione en React Native
// (debe importarse ANTES de crear el cliente).
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Mensaje claro en desarrollo si faltan las credenciales.
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copia .env.example a .env y completa las credenciales del proyecto web.',
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
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
