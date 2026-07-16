package expo.modules.lockscreen

import android.app.KeyguardManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.WindowManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Módulo nativo mínimo para activar/desactivar showWhenLocked + turnScreenOn
 * SOLO mientras se muestra la pantalla de llamada entrante (Esc2). Fuera de ese
 * momento la app se comporta normal y respeta la pantalla de bloqueo.
 *
 * Antes esto se marcaba estático en la MainActivity (AndroidManifest), lo que
 * hacía que la app quedara SIEMPRE visible sobre el bloqueo. Ahora es dinámico.
 */
class LockScreenModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LockScreen")

    Function("setShowWhenLocked") { enabled: Boolean ->
      val activity = appContext.currentActivity ?: return@Function
      activity.runOnUiThread {
        val flags = (
          WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
            or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            or WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
          )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
          activity.setShowWhenLocked(enabled)
          activity.setTurnScreenOn(enabled)
          if (enabled) {
            val km = activity.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
            km?.requestDismissKeyguard(activity, null)
          }
        }
        // Flags de ventana (compat + refuerzo): se agregan al activar y se
        // limpian al desactivar, para no dejar residuos que mantengan la app
        // sobre el bloqueo.
        if (enabled) activity.window.addFlags(flags) else activity.window.clearFlags(flags)
      }
    }

    // Estado real del permiso de Full Screen Intent. En Android 14 (API 34+)
    // ya NO se concede automáticamente: NotificationManager.canUseFullScreenIntent()
    // devuelve si el usuario lo permitió. En < 34 siempre está concedido.
    Function("canUseFullScreenIntent") {
      val activity = appContext.currentActivity ?: return@Function true
      if (Build.VERSION.SDK_INT >= 34) {
        val nm = activity.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        return@Function nm?.canUseFullScreenIntent() ?: false
      }
      return@Function true
    }

    // Abre el ajuste per-app de "notificaciones a pantalla completa" (Android 14+).
    Function("openFullScreenIntentSettings") {
      val activity = appContext.currentActivity ?: return@Function
      if (Build.VERSION.SDK_INT >= 34) {
        val intent = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
        intent.data = Uri.parse("package:" + activity.packageName)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(intent)
      }
    }
  }
}
