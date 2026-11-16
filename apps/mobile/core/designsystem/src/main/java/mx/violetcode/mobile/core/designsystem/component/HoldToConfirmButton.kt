package mx.violetcode.mobile.core.designsystem.component

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import mx.violetcode.mobile.core.designsystem.motion.VioletEasing
import mx.violetcode.mobile.core.designsystem.motion.VioletMotion
import mx.violetcode.mobile.core.designsystem.motion.rememberReducedMotion

/**
 * Botón circular de "mantener para confirmar" (motion-kit `hold-confirm`).
 *
 * Mientras se mantiene presionado, un anillo de progreso se llena durante [holdDurationMillis]; si se suelta
 * antes, el anillo regresa. Al completarse vibra (LongPress) y llama a [onConfirm] una sola vez por pulsación.
 * Evita falsas alarmas sin pedir un diálogo extra.
 *
 * Accesibilidad: con TalkBack u otros servicios, mantener presionado es difícil; por eso el nodo expone una
 * acción de clic semántica que confirma directamente (doble toque). Un toque normal NO confirma.
 *
 * El progreso se mide con el reloj de fotogramas, no con una animación, para que siga exigiendo el tiempo
 * completo aunque la usuaria tenga las animaciones del sistema apagadas.
 *
 * @param contentDescription descripción para lectores de pantalla (incluye la instrucción de mantener).
 * @param accessibilityActionLabel etiqueta de la acción directa para lectores de pantalla.
 * @param content contenido central (ícono + texto); hereda [contentColor].
 */
@Composable
fun HoldToConfirmButton(
    onConfirm: () -> Unit,
    contentDescription: String,
    modifier: Modifier = Modifier,
    accessibilityActionLabel: String = contentDescription,
    holdDurationMillis: Int = 1000,
    size: Dp = 200.dp,
    enabled: Boolean = true,
    containerColor: Color = MaterialTheme.colorScheme.error,
    contentColor: Color = MaterialTheme.colorScheme.onError,
    content: @Composable ColumnScope.() -> Unit,
) {
    val scope = rememberCoroutineScope()
    val haptic = LocalHapticFeedback.current
    val currentOnConfirm by rememberUpdatedState(onConfirm)
    val reduced = rememberReducedMotion()

    val progress = remember { Animatable(0f) }
    var pressed by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(
        targetValue = if (pressed) VioletMotion.PressedScale else 1f,
        animationSpec = if (reduced) snap<Float>() else VioletMotion.PressSpring,
        label = "holdScale",
    )

    val ringWidth = 8.dp
    val ringGap = 6.dp
    val trackColor = containerColor.copy(alpha = 0.2f)
    val a11yDescription = contentDescription

    Box(
        modifier = modifier
            .size(size)
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
            .semantics(mergeDescendants = true) {
                this.contentDescription = a11yDescription
                role = Role.Button
                if (enabled) {
                    onClick(label = accessibilityActionLabel) {
                        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                        currentOnConfirm()
                        true
                    }
                } else {
                    disabled()
                }
            }
            .pointerInput(enabled, holdDurationMillis) {
                if (!enabled) return@pointerInput
                detectTapGestures(
                    onPress = {
                        pressed = true
                        var confirmed = false
                        val holdJob = scope.launch {
                            val start = withFrameNanos { it }
                            var fraction = 0f
                            while (fraction < 1f) {
                                val now = withFrameNanos { it }
                                fraction = ((now - start) / 1_000_000f / holdDurationMillis).coerceIn(0f, 1f)
                                progress.snapTo(fraction)
                            }
                            confirmed = true
                            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                            currentOnConfirm()
                        }
                        tryAwaitRelease()
                        pressed = false
                        if (!confirmed) holdJob.cancel()
                        scope.launch {
                            // Confirmado: deja el anillo lleno un instante; cancelado: regresa de inmediato.
                            if (confirmed) delay(400)
                            progress.animateTo(
                                targetValue = 0f,
                                animationSpec = tween(
                                    durationMillis = if (confirmed) 300 else VioletMotion.FastMillis,
                                    easing = VioletEasing.Signature,
                                ),
                            )
                        }
                    },
                )
            },
        contentAlignment = Alignment.Center,
    ) {
        // Anillo de progreso: pista tenue + arco que se llena (se lee en la fase de dibujo).
        Canvas(Modifier.fillMaxSize()) {
            val stroke = ringWidth.toPx()
            val arcTopLeft = Offset(stroke / 2f, stroke / 2f)
            val arcSize = Size(this.size.width - stroke, this.size.height - stroke)
            drawArc(
                color = trackColor,
                startAngle = -90f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = arcTopLeft,
                size = arcSize,
                style = Stroke(width = stroke),
            )
            drawArc(
                color = containerColor,
                startAngle = -90f,
                sweepAngle = 360f * progress.value,
                useCenter = false,
                topLeft = arcTopLeft,
                size = arcSize,
                style = Stroke(width = stroke, cap = StrokeCap.Round),
            )
        }

        // Disco central: se aclara conforme avanza el progreso.
        Column(
            modifier = Modifier
                .padding(ringWidth + ringGap)
                .fillMaxSize()
                .background(containerColor, CircleShape)
                .drawBehind {
                    drawCircle(color = contentColor.copy(alpha = 0.18f * progress.value))
                },
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            CompositionLocalProvider(LocalContentColor provides contentColor) {
                content()
            }
        }
    }
}
