package mx.violetcode.mobile.core.designsystem.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp

// Radios alineados con motion-kit (superficies redondeadas y suaves).
private val VioletShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(20.dp),
    large = RoundedCornerShape(28.dp),
    extraLarge = RoundedCornerShape(36.dp),
)

/**
 * Tema de Violet Code. Los colores vienen de VioletColors.kt, generado desde el mismo
 * tema que usa el panel web (packages/design-tokens). No usar colores sueltos en pantallas.
 *
 * @param themeMode claro, oscuro o el del sistema (por defecto).
 */
@Composable
fun VioletTheme(themeMode: ThemeMode = ThemeMode.System, content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (themeMode.isDark()) VioletDarkScheme else VioletLightScheme,
        typography = VioletTypography,
        shapes = VioletShapes,
        content = content,
    )
}
