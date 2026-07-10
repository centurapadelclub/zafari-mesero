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
  // EAS Update (expo-updates): entrega de actualizaciones OTA.
  // runtimeVersion FIJO (string literal), NO policy: así el runtimeVersion no
  // depende del fingerprint del proyecto y cualquier OTA publicado con
  // runtimeVersion '1.0.0' aplica a un build cuyo runtimeVersion también sea
  // '1.0.0'. OJO: requiere un build NUEVO para que el build tome este valor.
  runtimeVersion: '1.0.0',
  updates: {
    url: 'https://u.expo.dev/ebc0643b-4c2f-4cf2-a624-5b1765f0e8cc',
  },
  orientation: 'portrait',
  // Ícono de la app (logo de Zafari).
  icon: './assets/logo-zafari-bg.png',
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
      // Logo de Zafari sobre fondo oscuro (Android).
      backgroundColor: '#0d0d0d',
      foregroundImage: './assets/logo-zafari-bg.png',
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
      'android.permission.SCHEDULE_EXACT_ALARM', // Snooze: reprogramar la llamada exactamente a los 30 s
      'android.permission.FOREGROUND_SERVICE', // servicio en segundo plano (proceso siempre vivo)
      'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE', // tipo del foreground service (Android 14+)
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    // NOTA: NO usamos expo-notifications. Toda la mensajería FCM es de
    // @react-native-firebase/messaging y la UI/canales son de notifee. Así
    // evitamos que dos librerías declaren el meta-data
    // com.google.firebase.messaging.default_notification_color y rompan el
    // manifest merger de Android.
    //
    // Firebase Cloud Messaging nativo (token + background handler, Esc2).
    '@react-native-firebase/app',
    // RNFirebase en iOS requiere frameworks estáticos.
    ['expo-build-properties', { ios: { useFrameworks: 'static' } }],
    // Salvaguarda: quita showWhenLocked/turnScreenOn ESTÁTICOS de la MainActivity
    // (el comportamiento sobre-bloqueo se controla de forma dinámica).
    // (@notifee/react-native se autolinkea, no necesita entrada en plugins.)
    './plugins/withFullScreenIntent',
    // Blinda el arranque en frío con el celular bloqueado (FSI de llamada):
    // activa showWhenLocked en MainActivity.onCreate solo si el keyguard está
    // bloqueado. El JS lo desactiva al cerrar la pantalla de llamada.
    './plugins/withIncomingCallActivity',
    // Declara foregroundServiceType="connectedDevice" en el service de notifee
    // (evita MissingForegroundServiceTypeException en Android 14+).
    './plugins/withForegroundServiceType',
    // Splash screen: logo de Zafari sobre fondo oscuro.
    [
      'expo-splash-screen',
      {
        image: './assets/logo-zafari-bg.png',
        // La imagen ya trae ~35% de margen; con este ancho el símbolo queda
        // proporcionado y centrado, con aire alrededor.
        imageWidth: 300,
        resizeMode: 'contain',
        backgroundColor: '#0d0d0d',
      },
    ],
  ],
  extra: {
    eas: {
      // projectId de EAS (se puede sobreescribir con la env EAS_PROJECT_ID).
      projectId: process.env.EAS_PROJECT_ID ?? 'ebc0643b-4c2f-4cf2-a624-5b1765f0e8cc',
    },
    // Credenciales de Supabase embebidas en el config (además de EXPO_PUBLIC_*).
    // Se leen acá en tiempo de build (cuando las env de EAS están presentes) y
    // quedan disponibles en runtime vía Constants.expoConfig.extra — más robusto
    // que depender solo del inlining de process.env en el bundle nativo.
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? null,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? null,
  },
});
