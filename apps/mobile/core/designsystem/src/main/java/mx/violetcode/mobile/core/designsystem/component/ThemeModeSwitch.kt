package mx.violetcode.mobile.core.designsystem.component

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.LightMode
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import mx.violetcode.mobile.core.designsystem.motion.VioletEasing
import mx.violetcode.mobile.core.designsystem.motion.VioletMotion
import mx.violetcode.mobile.core.designsystem.motion.pressScale
import mx.violetcode.mobile.core.designsystem.motion.rememberReducedMotion

// Colores del glass-switch con icons="theme" de motion-kit: pista de día/noche, sol ámbar, luna índigo.
private val DayTrack = Color(0xFFCCD4F8)
private val NightTrack = Color(0xFF121735)
private val SunColor = Color(0xFFF5B301)
private val MoonColor = Color(0xFF4F5FD8)
private val NightThumb = Color(0xFFEEF0FF)

/**
 * Interruptor claro/oscuro (motion-kit `glass-switch` con `icons="theme"`): la perilla muestra un sol que
 * gira y se desvanece hacia una luna al activarse. Responde con presión elástica.
 *
 * @param darkTheme `true` = modo oscuro activo.
 */
@Composable
fun ThemeModeSwitch(
    darkTheme: Boolean,
    onDarkThemeChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    contentDescription: String = "Modo oscuro",
) {
    val reduced = rememberReducedMotion()
    val interactionSource = remember { MutableInteractionSource() }
    val p by animateFloatAsState(
        targetValue = if (darkTheme) 1f else 0f,
        animationSpec = if (reduced) snap<Float>() else tween(VioletMotion.FastMillis + 50, easing = VioletEasing.Glass),
        label = "themeSwitch",
    )
    val a11yDescription = contentDescription

    Switch(
        checked = darkTheme,
        onCheckedChange = onDarkThemeChange,
        modifier = modifier
            .pressScale(interactionSource)
            .semantics { this.contentDescription = a11yDescription },
        interactionSource = interactionSource,
        colors = SwitchDefaults.colors(
            checkedThumbColor = NightThumb,
            checkedTrackColor = NightTrack,
            checkedBorderColor = Color.Transparent,
            uncheckedThumbColor = Color.White,
            uncheckedTrackColor = DayTrack,
            uncheckedBorderColor = Color.Transparent,
        ),
        thumbContent = {
            Box(Modifier.size(SwitchDefaults.IconSize)) {
                // Sol: sale conforme p→1 (gira 90° y se encoge).
                Icon(
                    imageVector = Icons.Outlined.LightMode,
                    contentDescription = null,
                    tint = SunColor,
                    modifier = Modifier.fillMaxSize().graphicsLayer {
                        alpha = ((0.7f - p) / 0.4f).coerceIn(0f, 1f)
                        rotationZ = p * 90f
                        val s = 1f - p * 0.5f
                        scaleX = s
                        scaleY = s
                    },
                )
                // Luna: entra conforme p→1.
                Icon(
                    imageVector = Icons.Outlined.DarkMode,
                    contentDescription = null,
                    tint = MoonColor,
                    modifier = Modifier.fillMaxSize().graphicsLayer {
                        alpha = ((p - 0.3f) / 0.4f).coerceIn(0f, 1f)
                        rotationZ = (1f - p) * -90f
                        val s = 0.5f + p * 0.5f
                        scaleX = s
                        scaleY = s
                    },
                )
            }
        },
    )
}
