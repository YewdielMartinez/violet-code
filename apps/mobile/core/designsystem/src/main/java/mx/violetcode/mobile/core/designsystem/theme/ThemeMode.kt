package mx.violetcode.mobile.core.designsystem.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable

/** Preferencia de tema de la usuaria. `System` sigue el modo del teléfono. */
enum class ThemeMode { System, Light, Dark }

/** Resuelve si el modo efectivo es oscuro (consulta el sistema cuando es [ThemeMode.System]). */
@Composable
fun ThemeMode.isDark(): Boolean = when (this) {
    ThemeMode.System -> isSystemInDarkTheme()
    ThemeMode.Light -> false
    ThemeMode.Dark -> true
}
