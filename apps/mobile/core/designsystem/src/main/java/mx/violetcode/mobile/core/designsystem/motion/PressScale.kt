package mx.violetcode.mobile.core.designsystem.motion

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer

/**
 * Presión elástica (motion-kit `--mk-ease-press`): al presionar se encoge a [pressedScale] y al soltar
 * regresa con un muelle poco amortiguado. Sin animación si el sistema tiene las animaciones apagadas.
 *
 * Uso: comparte el mismo [InteractionSource] con el componente que recibe el toque.
 * ```
 * val source = remember { MutableInteractionSource() }
 * Card(onClick = ..., interactionSource = source, modifier = Modifier.pressScale(source)) { ... }
 * ```
 */
@Composable
fun Modifier.pressScale(
    interactionSource: InteractionSource,
    pressedScale: Float = VioletMotion.PressedScale,
): Modifier {
    val pressed by interactionSource.collectIsPressedAsState()
    val reduced = rememberReducedMotion()
    val scale by animateFloatAsState(
        targetValue = if (pressed) pressedScale else 1f,
        animationSpec = if (reduced) snap<Float>() else VioletMotion.PressSpring,
        label = "pressScale",
    )
    // La lectura de `scale` ocurre en la fase de dibujo: no recompone en cada fotograma.
    return this.graphicsLayer {
        scaleX = scale
        scaleY = scale
    }
}
