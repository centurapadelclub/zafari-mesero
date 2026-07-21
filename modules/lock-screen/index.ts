import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Módulo local (solo Android). Activa/desactiva showWhenLocked + turnScreenOn de
 * forma dinámica. Si el módulo nativo no está presente (p. ej. Expo Go o un build
 * viejo), las funciones son no-ops silenciosos.
 */
interface LockScreenNative {
  setShowWhenLocked(enabled: boolean): void;
  isKeyguardLocked(): boolean;
  canUseFullScreenIntent(): boolean;
  openFullScreenIntentSettings(): void;
  canDrawOverlays(): boolean;
  openOverlaySettings(): void;
  isIgnoringBatteryOptimizations(): boolean;
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
 * Estado del keyguard: true = pantalla bloqueada, false = desbloqueada.
 * Devuelve null si el método nativo no está presente en este build (requiere el
 * build que agrega isKeyguardLocked). Se chequea con typeof porque un build
 * viejo tiene el módulo pero SIN esta función.
 */
export function isKeyguardLocked(): boolean | null {
  try {
    if (LockScreen && typeof LockScreen.isKeyguardLocked === 'function') {
      return LockScreen.isKeyguardLocked();
    }
    return null;
  } catch {
    return null;
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

/** "Mostrar sobre otras apps" (SYSTEM_ALERT_WINDOW). null si no se pudo leer. */
export function canDrawOverlays(): boolean | null {
  try {
    return LockScreen ? LockScreen.canDrawOverlays() : null;
  } catch {
    return null;
  }
}

export function openOverlaySettings(): void {
  try {
    LockScreen?.openOverlaySettings();
  } catch {
    // no-op
  }
}

/** true = la app está exenta de optimización de batería. null si no se pudo leer. */
export function isIgnoringBatteryOptimizations(): boolean | null {
  try {
    return LockScreen ? LockScreen.isIgnoringBatteryOptimizations() : null;
  } catch {
    return null;
  }
}
