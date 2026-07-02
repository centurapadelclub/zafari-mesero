const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Config plugin: ELIMINA el meta-data
 * `com.google.firebase.messaging.default_notification_color` del AndroidManifest
 * de la app.
 *
 * ¿Por qué? expo-notifications (cuando se le pasa `color`) y
 * @react-native-firebase/messaging definen los dos ese mismo meta-data con
 * valores distintos, y el manifest merger de Android falla. Intentar
 * sobreescribirlo con tools:replace no resolvió el conflicto en el build de
 * producción, así que directamente lo quitamos de nuestro manifest y dejamos que
 * gane el que trae RNFirebase en su propia librería (@color/white).
 *
 * Si en el futuro se quiere un color de notificación propio, se define acá de
 * forma controlada (android:resource + tools:replace apuntando a un @color propio).
 *
 * Debe ejecutarse AL FINAL (después de expo-notifications).
 */
const META_NAME = 'com.google.firebase.messaging.default_notification_color';

module.exports = function withRemoveFcmDefaultColor(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    if (!application || !application['meta-data']) return cfg;

    application['meta-data'] = application['meta-data'].filter(
      (m) => m.$?.['android:name'] !== META_NAME,
    );
    return cfg;
  });
};
