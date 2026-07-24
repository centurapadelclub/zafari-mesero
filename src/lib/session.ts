import AsyncStorage from '@react-native-async-storage/async-storage';
import { Id } from '../types/db';

/**
 * Fuente ÚNICA de la clave donde AuthContext persiste la sesión del mesero.
 * La usan tanto AuthContext (React) como el flujo de notificaciones fuera de React
 * (index.ts background handler, App.tsx onMessage) para saber si hay sesión activa
 * sin depender del estado de React (que no existe en el background handler).
 */
export const SESSION_STORAGE_KEY = 'zafari.mesero.session';

/** Clave del identificador único de ESTE dispositivo (una sola sesión por equipo). */
const DEVICE_ID_KEY = 'zafari.device_id';

interface StoredSessionLite {
  id?: Id;
}

/** UUID v4 en JS puro (sin dependencia nativa; OK para un id de dispositivo). */
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Identificador estable de esta instalación. Se genera UNA vez y se guarda en
 * AsyncStorage; sobrevive reinicios (pero NO reinstalaciones, que es lo deseable:
 * una reinstalación es un "equipo nuevo"). NO usamos el token FCM como id porque
 * cambia y es poco confiable.
 */
export async function getDeviceId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = uuidv4();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    // Si AsyncStorage falla, devolvemos un id efímero (mejor que romper el login).
    return uuidv4();
  }
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
