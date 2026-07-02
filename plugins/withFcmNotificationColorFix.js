const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Config plugin: resuelve el conflicto de manifest merger sobre el meta-data
 * `com.google.firebase.messaging.default_notification_color`.
 *
 * Lo definen a la vez expo-notifications (en el manifest de la app, con
 * @color/notification_icon_color) y @react-native-firebase/messaging (con
 * @color/white). Agregamos tools:replace="android:resource" al meta-data de la
 * app para que gane el valor de la app y el merge no falle.
 *
 * Debe ejecutarse DESPUÉS de expo-notifications (que agrega el meta-data), por
 * eso va al final del array de plugins en app.config.ts.
 */
const META_NAME = 'com.google.firebase.messaging.default_notification_color';

module.exports = function withFcmNotificationColorFix(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // Asegurar el namespace tools (necesario para tools:replace).
    manifest.$ = manifest.$ || {};
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    const application = manifest.application?.[0];
    if (!application) return cfg;
    application['meta-data'] = application['meta-data'] || [];

    let meta = application['meta-data'].find(
      (m) => m.$?.['android:name'] === META_NAME,
    );
    if (!meta) {
      // Si expo-notifications no lo agregó, lo creamos apuntando al color de la app.
      meta = {
        $: {
          'android:name': META_NAME,
          'android:resource': '@color/notification_icon_color',
        },
      };
      application['meta-data'].push(meta);
    }
    meta.$['tools:replace'] = 'android:resource';

    return cfg;
  });
};
