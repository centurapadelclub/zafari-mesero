/**
 * Handler global de errores JS. Evita el cierre inmediato y silencioso: registra
 * el error (visible en `adb logcat` / `npx react-native log-android`) en vez de
 * dejar que un error no atrapado tumbe la app sin dejar rastro.
 *
 * Nota: esto cubre errores JS no atrapados. Los errores de render los muestra el
 * ErrorBoundary; los de tiempo de carga de módulos se manejan con try-catch en
 * index.ts / supabase.ts.
 */
export function installGlobalErrorHandler(): void {
  const g = globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
      setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
    };
  };

  if (!g.ErrorUtils?.setGlobalHandler) return;

  const previous = g.ErrorUtils.getGlobalHandler?.();

  g.ErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    const e = error as Error | undefined;
    // eslint-disable-next-line no-console
    console.error(
      `[GlobalError]${isFatal ? ' (fatal)' : ''}`,
      e?.name,
      e?.message,
      '\n',
      e?.stack,
    );
    // En desarrollo dejamos que el handler original muestre la pantalla roja.
    if (__DEV__ && previous) previous(error, isFatal);
    // En release NO re-lanzamos: preferimos mantener la app viva para poder ver
    // logs, en vez de un cierre silencioso.
  });
}
