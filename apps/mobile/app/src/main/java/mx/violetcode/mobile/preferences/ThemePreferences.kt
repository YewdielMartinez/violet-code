package mx.violetcode.mobile.preferences

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import mx.violetcode.mobile.core.designsystem.theme.ThemeMode

/**
 * Preferencia de tema (claro / oscuro / sistema) en SharedPreferences, clave "theme_mode".
 * Solo guarda una preferencia visual, nunca datos de la usuaria. Se expone como [StateFlow]
 * para que MainActivity recomponga el tema al cambiarla.
 */
class ThemePreferences(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    private val _mode = MutableStateFlow(read())
    val mode: StateFlow<ThemeMode> = _mode.asStateFlow()

    fun setMode(mode: ThemeMode) {
        prefs.edit().putString(KEY, mode.name).apply()
        _mode.value = mode
    }

    private fun read(): ThemeMode =
        ThemeMode.entries.firstOrNull { it.name == prefs.getString(KEY, null) } ?: ThemeMode.System

    private companion object {
        const val FILE = "violet_prefs"
        const val KEY = "theme_mode"
    }
}
