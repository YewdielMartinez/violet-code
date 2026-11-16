package mx.violetcode.mobile.core.designsystem.motion

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Entrada con desvanecido y ascenso (motion-kit `fade-content`, sin desenfoque): opacidad 0→1 y
 * desplazamiento vertical [offset]→0, con un retraso de [staggerMillis] por cada [index].
 *
 * - El retraso se limita a [VioletMotion.MaxStaggerSteps] pasos para que las listas largas no esperen.
 * - Se reproduce una sola vez por elemento (el estado se guarda), así que al volver a una pestaña o al
 *   desplazar una lista hacia atrás no se repite.
 * - Sin animación si el sistema tiene las animaciones apagadas.
 */
@Composable
fun Modifier.fadeInOnAppear(
    index: Int = 0,
    offset: Dp = 16.dp,
    staggerMillis: Int = VioletMotion.StaggerMillis,
    durationMillis: Int = VioletMotion.DurationMillis,
): Modifier {
    val reduced = rememberReducedMotion()
    var played by rememberSaveable { mutableStateOf(false) }
    val progress = remember { Animatable(if (reduced || played) 1f else 0f) }

    LaunchedEffect(Unit) {
        if (progress.value < 1f) {
            progress.animateTo(
                targetValue = 1f,
                animationSpec = tween(
                    durationMillis = durationMillis,
                    delayMillis = index.coerceIn(0, VioletMotion.MaxStaggerSteps) * staggerMillis,
                    easing = VioletEasing.Signature,
                ),
            )
        }
        played = true
    }

    val offsetPx = with(LocalDensity.current) { offset.toPx() }
    return this.graphicsLayer {
        alpha = progress.value
        translationY = (1f - progress.value) * offsetPx
    }
}
