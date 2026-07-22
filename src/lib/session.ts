import AsyncStorage from '@react-native-async-storage/async-storage';
import { Id } from '../types/db';

/**
 * Fuente ÚNICA de la clave donde AuthContext persiste la sesión del mesero.
 * La usan tanto AuthContext (React) como el flujo de notificaciones fuera de React
 * (index.ts background handler, App.tsx onMessage) para saber si hay sesión activa
 * sin depender del estado de React (que no existe en el background handler).
 */
export const SESSION_STORAGE_KEY = 'zafari.mesero.session';

interface StoredSessionLite {
  id?: Id;
}

/** true si hay una sesión de mesero guardada (logueado). */
export async function hasActiveSession(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    return !!raw;
  } catch {
    return false;
  }
}
