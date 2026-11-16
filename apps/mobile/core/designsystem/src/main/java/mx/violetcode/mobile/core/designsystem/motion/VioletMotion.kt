package mx.violetcode.mobile.core.designsystem.motion

import android.content.Context
import android.provider.Settings
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.SpringSpec
import androidx.compose.animation.core.spring
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalInspectionMode

/**
 * Vocabulario de movimiento de Violet Code, tomado de motion-kit (dist/css/tokens.css).
 * Los valores de aquí son la única fuente en Android: no escribir duraciones ni curvas sueltas en pantallas.
 */
object VioletEasing {
    /** Aproximación cúbica de `--mk-ease-signature` (arranque rápido, aterrizaje suave). */
    val Signature: Easing = CubicBezierEasing(0.16f, 1f, 0.3f, 1f)

    /** `--mk-ease-glass`: cubic-bezier(0.25, 1, 0.5, 1). */
    val Glass: Easing = CubicBezierEasing(0.25f, 1f, 0.5f, 1f)

    /** `--mk-ease-flow`: cubic-bezier(0.25, 0.1, 0.25, 1). */
    val Flow: Easing = CubicBezierEasing(0.25f, 0.1f, 0.25f, 1f)
}

object VioletMotion {
    /** Escala al presionar (rebote elástico estilo `--mk-ease-press`, "Motion 400/10"). */
    const val PressedScale = 0.95f

    /** Muelle de presión: poco amortiguado y rigidez media, rebasa un poco al soltar. */
    val PressSpring: SpringSpec<Float> = spring(dampingRatio = 0.45f, stiffness = 400f)

    /** Retraso entre elementos consecutivos de una entrada escalonada (fade-content). */
    const val StaggerMillis = 60

    /** Máximo de pasos de escalonado: evita esperar demasiado en listas largas. */
    const val MaxStaggerSteps = 8

    /** `--mk-dur`: 450 ms. */
    const val DurationMillis = 450

    /** `--mk-dur-fast`: 250 ms. */
    const val FastMillis = 250

    /** Cambio de pestaña (navegación lateral): solo desvanecer, corto. */
    const val TabFadeMillis = 200
}

/** `true` si la usuaria desactivó las animaciones del sistema (escala de animación = 0). */
fun isReducedMotion(context: Context): Boolean = try {
    Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
} catch (e: Exception) {
    false
}

/** Versión Compose de [isReducedMotion]. En vistas previas siempre es `false`. */
@Composable
fun rememberReducedMotion(): Boolean {
    val context = LocalContext.current
    val inspecting = LocalInspectionMode.current
    return remember(context, inspecting) { !inspecting && isReducedMotion(context) }
}
