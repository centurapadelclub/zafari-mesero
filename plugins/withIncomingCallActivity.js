const { withMainActivity } = require('@expo/config-plugins');

/**
 * Config plugin: blinda el ARRANQUE EN FRÍO con el celular bloqueado.
 *
 * Cuando un Full Screen Intent de llamada abre la app estando bloqueada, la
 * MainActivity.onCreate corre ANTES que el JS, así que el módulo dinámico
 * (LockScreen) todavía no aplicó showWhenLocked. Este plugin inyecta, en
 * onCreate, la activación INCONDICIONAL de showWhenLocked/turnScreenOn.
 *
 * ¿Por qué SIEMPRE (sin chequear el keyguard)? El chequeo
 * `isKeyguardLocked == true` era una race condition: a veces el estado del
 * keyguard no se refleja a tiempo en onCreate → los flags no se activaban → la
 * app abría normal (~2 de 5 veces). Como el delay no importa y lo único que
 * importa es CONFIABILIDAD, activamos siempre.
 *
 * ¿Es seguro dejarlo siempre activo? Sí, PORQUE el cleanup está garantizado:
 * IncomingCallScreen llama setShowWhenLocked(false) de forma EXPLÍCITA en todos
 * sus caminos de salida (atender, ignorar, snooze, ver pedido) además del
 * desmontaje. Eso limpia estos flags y restaura el comportamiento normal, así
 * que la app NO queda visible sobre el bloqueo tras cerrar la llamada.
 */
const MARKER = 'Zafari-incoming-call-cold-start';

const SNIPPET = `
    // ${MARKER}: arranque en frío con el celular bloqueado (FSI de llamada).
    // Incondicional (evita la race del keyguard). Se limpia desde JS
    // (LockScreen.setShowWhenLocked(false)) en todos los caminos de salida.
    try {
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
        setShowWhenLocked(true)
        setTurnScreenOn(true)
      }
      window.addFlags(
        android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
      )
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
