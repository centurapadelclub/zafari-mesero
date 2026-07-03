const { withMainActivity } = require('@expo/config-plugins');

/**
 * Config plugin: blinda el ARRANQUE EN FRÍO con el celular bloqueado.
 *
 * Cuando un Full Screen Intent de llamada abre la app estando bloqueada, la
 * MainActivity.onCreate corre ANTES que el JS, así que el módulo dinámico
 * (LockScreen) todavía no aplicó showWhenLocked. Este plugin inyecta, en
 * onCreate, la activación de showWhenLocked/turnScreenOn PERO solo si el
 * keyguard está bloqueado en ese momento.
 *
 * ¿Por qué es seguro (no reintroduce el bug de "siempre sobre el bloqueo")?
 * Un arranque en frío con el keyguard bloqueado solo ocurre por el FSI de la
 * llamada (un launch normal desde el launcher pasa DESPUÉS de desbloquear, con
 * el keyguard ya abierto → no se activan los flags). Además, al cerrar la
 * pantalla de llamada, el JS llama setShowWhenLocked(false) y limpia los flags.
 */
const MARKER = 'Zafari-incoming-call-cold-start';

const SNIPPET = `
    // ${MARKER}: arranque en frío con el celular bloqueado (FSI de llamada).
    // Se limpia desde JS (LockScreen.setShowWhenLocked(false)) al cerrar la pantalla.
    try {
      val zafariKeyguard = getSystemService(android.content.Context.KEYGUARD_SERVICE) as? android.app.KeyguardManager
      if (zafariKeyguard?.isKeyguardLocked == true) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
          setShowWhenLocked(true)
          setTurnScreenOn(true)
        }
        window.addFlags(
          android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        )
      }
    } catch (e: Exception) {}`;

module.exports = function withIncomingCallActivity(config) {
  return withMainActivity(config, (cfg) => {
    // Solo Kotlin (template por defecto de Expo SDK 50+).
    if (cfg.modResults.language !== 'kt') return cfg;
    let src = cfg.modResults.contents;
    if (src.includes(MARKER)) return cfg; // idempotente

    // Insertar justo después de la llamada a super.onCreate(...).
    const replaced = src.replace(/(super\.onCreate\([^)]*\))/, `$1${SNIPPET}`);
    if (replaced === src) {
      // No se encontró super.onCreate: no rompemos el build, solo avisamos.
      // eslint-disable-next-line no-console
      console.warn('[withIncomingCallActivity] no se encontró super.onCreate(); se omite la inyección.');
      return cfg;
    }
    cfg.modResults.contents = replaced;
    return cfg;
  });
};
