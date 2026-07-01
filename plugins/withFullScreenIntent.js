const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Config plugin: habilita que la app se muestre a pantalla completa sobre la
 * pantalla de bloqueo cuando llega una llamada entrante (Escenario 2).
 *
 * Marca la MainActivity con showWhenLocked + turnScreenOn. El permiso
 * SYSTEM_ALERT_WINDOW y USE_FULL_SCREEN_INTENT se declaran en app.config.ts
 * (sección android.permissions).
 */
module.exports = function withFullScreenIntent(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    if (!application) return cfg;

    const activities = application.activity ?? [];
    const main = activities.find(
      (a) => a.$?.['android:name'] === '.MainActivity',
    );
    if (main) {
      main.$['android:showWhenLocked'] = 'true';
      main.$['android:turnScreenOn'] = 'true';
    }
    return cfg;
  });
};
