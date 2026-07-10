const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Config plugin: asegura que el Foreground Service de notifee declare
 * android:foregroundServiceType="connectedDevice" en el AndroidManifest.
 *
 * En Android 14+ (targetSdk 34), arrancar un foreground service con un tipo que
 * NO está declarado en el manifest lanza MissingForegroundServiceTypeException.
 * El service `app.notifee.core.ForegroundService` viene del AAR de notifee (no
 * del template), así que lo mergeamos con tools:node="merge" + tools:replace
 * para inyectarle el tipo sin duplicar el service.
 *
 * El permiso FOREGROUND_SERVICE_CONNECTED_DEVICE se declara en app.config.ts.
 */
const SERVICE_NAME = 'app.notifee.core.ForegroundService';
const SERVICE_TYPE = 'connectedDevice';

module.exports = function withForegroundServiceType(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // Asegurar el namespace tools en el <manifest>.
    manifest.$ = manifest.$ || {};
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    const application = manifest.application?.[0];
    if (!application) return cfg;
    application.service = application.service || [];

    const existing = application.service.find(
      (s) => s.$?.['android:name'] === SERVICE_NAME,
    );

    if (existing) {
      existing.$['android:foregroundServiceType'] = SERVICE_TYPE;
      existing.$['tools:node'] = 'merge';
      existing.$['tools:replace'] = 'android:foregroundServiceType';
    } else {
      application.service.push({
        $: {
          'android:name': SERVICE_NAME,
          'android:foregroundServiceType': SERVICE_TYPE,
          'tools:node': 'merge',
          'tools:replace': 'android:foregroundServiceType',
        },
      });
    }

    return cfg;
  });
};
