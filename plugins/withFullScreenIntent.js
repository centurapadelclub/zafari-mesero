const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Config plugin: se asegura de que la MainActivity NO tenga showWhenLocked ni
 * turnScreenOn de forma ESTÁTICA.
 *
 * Antes marcábamos esos atributos estáticos y la app quedaba SIEMPRE visible
 * sobre la pantalla de bloqueo. Ahora ese comportamiento se activa/desactiva de
 * forma DINÁMICA (módulo nativo local `LockScreen`) solo mientras se muestra la
 * pantalla de llamada entrante (Esc2). Este plugin queda como salvaguarda: si el
 * template base agregara esos atributos, los removemos.
 *
 * Los permisos USE_FULL_SCREEN_INTENT / SYSTEM_ALERT_WINDOW se declaran en
 * app.config.ts (sección android.permissions).
 */
module.exports = function withFullScreenIntent(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    if (!application) return cfg;

    const activities = application.activity ?? [];
    const main = activities.find((a) => a.$?.['android:name'] === '.MainActivity');
    if (main && main.$) {
      delete main.$['android:showWhenLocked'];
      delete main.$['android:turnScreenOn'];
    }
    return cfg;
  });
};
