import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Preferencias locales del mesero (AsyncStorage).
 *  - soundPref: afecta SOLO al Escenario 2 (llamada entrante a pantalla completa).
 *    El Escenario 3 (heads-up con la app en uso) es siempre sin sonido.
 */

export type SoundPref = 'sound_vibration' | 'vibration_only';

const KEY_SOUND = 'zafari.pref.sound';
const KEY_ONBOARDING = 'zafari.pref.onboardingDone';

export async function getSoundPref(): Promise<SoundPref> {
  const v = await AsyncStorage.getItem(KEY_SOUND);
  return v === 'vibration_only' ? 'vibration_only' : 'sound_vibration'; // default: con sonido
}

export async function setSoundPref(pref: SoundPref): Promise<void> {
  await AsyncStorage.setItem(KEY_SOUND, pref);
}

export async function isOnboardingDone(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY_ONBOARDING)) === 'true';
}

export async function setOnboardingDone(): Promise<void> {
  await AsyncStorage.setItem(KEY_ONBOARDING, 'true');
}
