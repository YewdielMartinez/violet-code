package mx.violetcode.mobile

import android.graphics.Color
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import mx.violetcode.mobile.core.designsystem.theme.VioletTheme
import mx.violetcode.mobile.core.designsystem.theme.isDark
import mx.violetcode.mobile.preferences.ThemePreferences
import mx.violetcode.mobile.ui.VioletApp
import org.koin.android.ext.android.inject

class MainActivity : ComponentActivity() {
    private val themePreferences: ThemePreferences by inject()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Sin capturas de pantalla ni vista previa en "recientes": protege a la usuaria.
        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        enableEdgeToEdge()
        setContent {
            val themeMode by themePreferences.mode.collectAsStateWithLifecycle()
            val darkTheme = themeMode.isDark()

            // Íconos de las barras del sistema legibles aunque el tema elegido difiera del del teléfono.
            DisposableEffect(darkTheme) {
                this@MainActivity.enableEdgeToEdge(
                    statusBarStyle = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT) { darkTheme },
                    navigationBarStyle = SystemBarStyle.auto(
                        lightScrim = Color.argb(0xe6, 0xFF, 0xFF, 0xFF),
                        darkScrim = Color.argb(0x80, 0x1b, 0x1b, 0x1b),
                    ) { darkTheme },
                )
                onDispose {}
            }

            VioletTheme(themeMode = themeMode) {
                VioletApp(
                    themeMode = themeMode,
                    onThemeModeChange = themePreferences::setMode,
                    onQuickExit = ::quickExit,
                )
            }
        }
    }

    /** Salida rápida: cierra la app y la quita de la pila de tareas. */
    private fun quickExit() {
        finishAndRemoveTask()
    }
}
