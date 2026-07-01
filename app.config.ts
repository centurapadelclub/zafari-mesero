import { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Configuración dinámica de Expo.
 *
 * Valores sensibles / específicos del entorno se leen de variables de entorno
 * (.env). Para que estén disponibles en el bundle del cliente usan el prefijo
 * EXPO_PUBLIC_ (ver .env.example).
 *
 * El archivo google-services.json (lo descargas de Firebase) NO se commitea.
 * Por defecto se busca en la raíz del proyecto; puedes sobreescribir la ruta
 * con la variable GOOGLE_SERVICES_JSON.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Zafari Mesero',
  slug: 'zafari-mesero',
  scheme: 'zafarimesero',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.zafari.mesero',
  },
  android: {
    package: 'com.zafari.mesero',
    // google-services.json se genera en Firebase (ver pasos en el README).
    // Solo es necesario al compilar el dev build / producción, no para `expo start`.
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    adaptiveIcon: {
      backgroundColor: '#D32F2F',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Permisos para las notificaciones tipo "llamado":
    permissions: [
      'android.permission.POST_NOTIFICATIONS', // Android 13+ requiere pedir permiso de notificaciones
      'android.permission.VIBRATE', // patrones de vibración
      'android.permission.WAKE_LOCK', // despertar la pantalla al llegar el llamado
      'android.permission.USE_FULL_SCREEN_INTENT', // Esc2: pantalla completa con el celular bloqueado
      'android.permission.SYSTEM_ALERT_WINDOW', // Esc2: mostrar sobre otras apps
      'android.permission.RECEIVE_BOOT_COMPLETED',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    [
      'expo-notifications',
      {
        // Color del ícono pequeño de la notificación en Android.
        color: '#D32F2F',
        // Permite que las notificaciones despierten la app en segundo plano.
        enableBackgroundRemoteNotifications: true,
      },
    ],
    // Marca la MainActivity para mostrarse sobre el bloqueo (Esc2).
    // (@notifee/react-native se autolinkea, no necesita entrada en plugins.)
    './plugins/withFullScreenIntent',
  ],
  extra: {
    eas: {
      // projectId de EAS (se puede sobreescribir con la env EAS_PROJECT_ID).
      projectId: process.env.EAS_PROJECT_ID ?? '1b797dc8-a17e-4d38-9dd2-3a816f0ba354',
    },
  },
});
