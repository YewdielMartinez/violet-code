package mx.violetcode.mobile.security

import android.app.Activity
import android.app.Application
import android.os.Bundle
import android.view.WindowManager

/**
 * Pone FLAG_SECURE en la ventana de TODA actividad de la app, al crearse: sin capturas de pantalla, sin
 * grabación y con la vista previa de «recientes» en blanco. Los diálogos y menús de Compose heredan el
 * flag de su ventana anfitriona (`SecureFlagPolicy.Inherit`, el valor por defecto).
 * MainActivity además lo fija ella misma; esto cubre cualquier actividad futura.
 */
class SecureWindowCallbacks : Application.ActivityLifecycleCallbacks {
    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        activity.window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
    }

    override fun onActivityStarted(activity: Activity) = Unit
    override fun onActivityResumed(activity: Activity) = Unit
    override fun onActivityPaused(activity: Activity) = Unit
    override fun onActivityStopped(activity: Activity) = Unit
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
    override fun onActivityDestroyed(activity: Activity) = Unit
}
