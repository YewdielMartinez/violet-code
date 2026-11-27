package mx.violetcode.mobile

import android.app.ActivityManager
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.toBitmap
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import mx.violetcode.mobile.core.designsystem.theme.VioletTheme
import mx.violetcode.mobile.core.designsystem.theme.isDark
import mx.violetcode.mobile.disguise.DisguiseController
import mx.violetcode.mobile.feature.disguise.CalculatorScreen
import mx.violetcode.mobile.preferences.ThemePreferences
import mx.violetcode.mobile.ui.VioletApp
import org.koin.android.ext.android.inject

class MainActivity : ComponentActivity() {
    private val themePreferences: ThemePreferences by inject()
    private val disguise: DisguiseController by inject()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Sin capturas de pantalla ni vista previa en "recientes": protege a la usuaria.
        // (SecureWindowCallbacks lo repite para toda actividad; aquí queda explícito para esta.)
        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        if (Build.VERSION.SDK_INT >= 33) setRecentsScreenshotEnabled(false)
        enableEdgeToEdge()

        // Con modo discreto, «recientes» debe mostrar una calculadora; sin él, la app no aparece.
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.CREATED) {
                disguise.enabled.collect(::applyTaskLook)
            }
        }

        setContent {
            val showCalculator by disguise.showCalculator.collectAsStateWithLifecycle()

            // Bloqueo por inactividad: revisa cada 10 s mientras la app está abierta.
            LaunchedEffect(Unit) {
                while (true) {
                    delay(10_000)
                    disguise.lockIfIdle()
                }
            }

            if (showCalculator) {
                // La calculadora no usa VioletTheme ni nada de la app: sin pistas visuales.
                DisposableEffect(Unit) {
                    this@MainActivity.enableEdgeToEdge(
                        statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
                        navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
                    )
                    onDispose {}
                }
                CalculatorScreen(onUnlockRequest = disguise::tryUnlock)
            } else {
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
    }

    override fun onUserInteraction() {
        super.onUserInteraction()
        disguise.onUserInteraction()
    }

    override fun onStop() {
        super.onStop()
        // Al pasar a segundo plano (no por girar la pantalla) con modo discreto: vuelve la calculadora.
        if (!isChangingConfigurations) {
            disguise.lock()
            // Aplica el cambio de ícono pendiente (activar/desactivar modo discreto) ya fuera de la vista.
            disguise.syncLauncher()
        }
    }

    /**
     * Salida rápida (siempre visible en la barra superior de todas las pantallas).
     * - Con modo discreto: la app se bloquea y queda a la vista solo la calculadora.
     * - Sin modo discreto: va al inicio del teléfono (o a un sitio neutro si la usuaria lo eligió) y
     *   quita la app de la pila de tareas / recientes.
     */
    private fun quickExit() {
        if (disguise.enabled.value) {
            disguise.lock()
            return
        }
        val destination = if (disguise.neutralSiteOnExit) {
            Intent(Intent.ACTION_VIEW, Uri.parse(NEUTRAL_SITE))
        } else {
            Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        }
        try {
            startActivity(destination.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: Exception) {
            // Sin navegador o sin launcher: basta con cerrar.
        }
        finishAndRemoveTask()
    }

    /** Etiqueta/ícono de «recientes» y presencia en la lista según el modo discreto. */
    @Suppress("DEPRECATION")
    private fun applyTaskLook(disguised: Boolean) {
        try {
            val manager = getSystemService(ACTIVITY_SERVICE) as ActivityManager
            manager.appTasks.forEach { it.setExcludeFromRecents(!disguised) }
            if (disguised) {
                val icon = ContextCompat.getDrawable(this, R.mipmap.ic_launcher_calculator)?.toBitmap(192, 192)
                setTaskDescription(ActivityManager.TaskDescription(getString(R.string.disguise_app_name), icon))
            } else {
                setTaskDescription(ActivityManager.TaskDescription(getString(R.string.app_name)))
            }
        } catch (e: Exception) {
            // Es un refuerzo de discreción: si el sistema lo rechaza, la app sigue funcionando.
        }
    }

    private companion object {
        const val NEUTRAL_SITE = "https://www.wikipedia.org"
    }
}
