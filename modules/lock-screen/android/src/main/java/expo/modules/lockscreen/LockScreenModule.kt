package expo.modules.lockscreen

import android.app.KeyguardManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.view.WindowManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Módulo nativo (solo Android). Controla showWhenLocked/turnScreenOn de forma
 * dinámica (Esc2) y expone lectores/abridores de permisos que notifee no cubre
 * (Full Screen Intent en Android 14, overlay, optimización de batería).
 *
 * NOTA de Kotlin/Expo: cada `Function` debe devolver un valor (Any?), no Unit.
 * Las que "hacen algo" (setShowWhenLocked, open*) terminan en `null` explícito
 * para no romper la compilación en release.
 */
class LockScreenModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LockScreen")

    Function("setShowWhenLocked") { enabled: Boolean ->
      val activity = appContext.currentActivity
      if (activity != null) {
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
          if (enabled) activity.window.addFlags(flags) else activity.window.clearFlags(flags)
        }
      }
      null
    }

    // Estado del keyguard: true = la pantalla está bloqueada (segura o no). Se usa
    // en el warm start para decidir si forzar la pantalla sobre el bloqueo
    // (bloqueado) o solo mostrar heads-up y esperar el tap (desbloqueado).
    Function("isKeyguardLocked") {
      val ctx = appContext.reactContext
      val km = ctx?.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
      if (ctx != null && km != null) km.isKeyguardLocked else false
    }

    // Estado real del permiso de Full Screen Intent. En Android 14 (API 34+) ya
    // NO se concede automáticamente. En < 34 siempre está concedido.
    Function("canUseFullScreenIntent") {
      val activity = appContext.currentActivity
      if (activity != null && Build.VERSION.SDK_INT >= 34) {
        val nm = activity.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        nm?.canUseFullScreenIntent() ?: false
      } else {
        true
      }
    }

    // Abre el ajuste per-app de "notificaciones a pantalla completa" (Android 14+).
    Function("openFullScreenIntentSettings") {
      val activity = appContext.currentActivity
      if (activity != null && Build.VERSION.SDK_INT >= 34) {
        val intent = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
        intent.data = Uri.parse("package:" + activity.packageName)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(intent)
      }
      null
    }

    // "Mostrar sobre otras apps" (SYSTEM_ALERT_WINDOW).
    Function("canDrawOverlays") {
      val ctx = appContext.reactContext
      if (ctx != null) Settings.canDrawOverlays(ctx) else false
    }

    Function("openOverlaySettings") {
      val activity = appContext.currentActivity
      if (activity != null) {
        val intent = Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:" + activity.packageName),
        )
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(intent)
      }
      null
    }

    // Optimización de batería: true = la app está exenta (no la matan).
    Function("isIgnoringBatteryOptimizations") {
      val ctx = appContext.reactContext
      val pm = ctx?.getSystemService(Context.POWER_SERVICE) as? PowerManager
      if (ctx != null && pm != null) pm.isIgnoringBatteryOptimizations(ctx.packageName) else false
    }
  }
}
