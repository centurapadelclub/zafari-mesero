import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Módulo local (solo Android). Activa/desactiva showWhenLocked + turnScreenOn de
 * forma dinámica. Si el módulo nativo no está presente (p. ej. Expo Go o un build
 * viejo), las funciones son no-ops silenciosos.
 */
interface LockScreenNative {
  setShowWhenLocked(enabled: boolean): void;
}

const LockScreen = requireOptionalNativeModule<LockScreenNative>('LockScreen');

export function setShowWhenLocked(enabled: boolean): void {
  try {
    LockScreen?.setShowWhenLocked(enabled);
  } catch {
    // el módulo puede no estar disponible en este build: no pasa nada
  }
}
