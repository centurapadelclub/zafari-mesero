import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Preferencias locales del mesero (AsyncStorage).
 *  - soundPref: afecta SOLO al Escenario 2 (llamada entrante a pantalla completa).
 *    El Escenario 3 (heads-up con la app en uso) es siempre sin sonido.
 */

export type SoundPref = 'sound_vibration' | 'vibration_only';

/** Tono de la llamada entrante (Esc2). Cada valor mapea a un .wav en assets/. */
export type TonePref = 'suave' | 'timbre' | 'alarma';

const KEY_SOUND = 'zafari.pref.sound';
const KEY_TONE = 'zafari.pref.tone';

export async function getSoundPref(): Promise<SoundPref> {
  const v = await AsyncStorage.getItem(KEY_SOUND);
  return v === 'vibration_only' ? 'vibration_only' : 'sound_vibration'; // default: con sonido
}

export async function setSoundPref(pref: SoundPref): Promise<void> {
  await AsyncStorage.setItem(KEY_SOUND, pref);
}

const TONES: TonePref[] = ['suave', 'timbre', 'alarma'];

export async function getTonePref(): Promise<TonePref> {
  const v = await AsyncStorage.getItem(KEY_TONE);
  return TONES.includes(v as TonePref) ? (v as TonePref) : 'timbre'; // default: timbre
}

export async function setTonePref(pref: TonePref): Promise<void> {
  await AsyncStorage.setItem(KEY_TONE, pref);
}
