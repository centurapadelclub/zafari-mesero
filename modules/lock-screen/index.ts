import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Módulo local (solo Android). Activa/desactiva showWhenLocked + turnScreenOn de
 * forma dinámica. Si el módulo nativo no está presente (p. ej. Expo Go o un build
 * viejo), las funciones son no-ops silenciosos.
 */
interface LockScreenNative {
  setShowWhenLocked(enabled: boolean): void;
  canUseFullScreenIntent(): boolean;
  openFullScreenIntentSettings(): void;
}

const LockScreen = requireOptionalNativeModule<LockScreenNative>('LockScreen');

export function setShowWhenLocked(enabled: boolean): void {
  try {
    LockScreen?.setShowWhenLocked(enabled);
  } catch {
    // el módulo puede no estar disponible en este build: no pasa nada
  }
}

/**
 * Estado real del permiso de Full Screen Intent (Android 14+). Devuelve:
 *  - true/false: permitido / bloqueado
 *  - null: no se pudo leer (módulo nativo ausente en este build)
 */
export function canUseFullScreenIntent(): boolean | null {
  try {
    return LockScreen ? LockScreen.canUseFullScreenIntent() : null;
  } catch {
    return null;
  }
}

/** Abre el ajuste per-app de "notificaciones a pantalla completa" (Android 14+). */
export function openFullScreenIntentSettings(): void {
  try {
    LockScreen?.openFullScreenIntentSettings();
  } catch {
    // no-op si el módulo no está disponible
  }
}
