package mx.violetcode.mobile

import android.app.ActivityManager
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.view.WindowManager
import android.view.animation.Interpolator
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.toBitmap
import androidx.core.splashscreen.SplashScreen
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.splashscreen.SplashScreenViewProvider
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import mx.violetcode.mobile.core.designsystem.motion.VioletEasing
import mx.violetcode.mobile.core.designsystem.motion.isReducedMotion
import mx.violetcode.mobile.core.designsystem.theme.VioletTheme
import mx.violetcode.mobile.core.designsystem.theme.isDark
import mx.violetcode.mobile.core.domain.account.SessionState
import mx.violetcode.mobile.core.domain.usecase.ObserveSessionUseCase
import mx.violetcode.mobile.disguise.DisguiseController
import mx.violetcode.mobile.feature.disguise.CalculatorScreen
import mx.violetcode.mobile.preferences.ThemePreferences
import mx.violetcode.mobile.ui.VioletApp
import org.koin.android.ext.android.inject

open class MainActivity : ComponentActivity() {
    private val themePreferences: ThemePreferences by inject()
    private val disguise: DisguiseController by inject()
    private val observeSession: ObserveSessionUseCase by inject()

    /** `true` en la entrada del ícono disfrazado ([CalculatorLauncherActivity]): arranque neutro, sin marca ni animación. */
    protected open val neutralSplash: Boolean = false

    override fun onCreate(savedInstanceState: Bundle?) {
        // Debe ir antes de super.onCreate: cambia al tema de la app (postSplashScreenTheme) y engancha la pantalla de arranque.
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        setUpSplash(splash)
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
                            darkScrim = Color.argb(0x80, 0x00, 0x00, 0x00),
                        ) { darkTheme },
                    )
                    onDispose {}
                }

                VioletTheme(themeMode = themeMode) {
                    VioletApp(onQuickExit = ::quickExit)
                }
            }
        }
    }

    /**
     * Mantiene la pantalla de arranque hasta que el estado inicial está listo (sesión leída; el tema y el modo
     * discreto se leen síncronos al crear sus objetos) con un tope de [SPLASH_MAX_MILLIS], y la quita con una
     * salida suave. En el modo discreto no espera ni anima: la calculadora debe aparecer sin pistas.
     */
    private fun setUpSplash(splash: SplashScreen) {
        val disguised = neutralSplash || disguise.enabled.value
        val startedAt = SystemClock.elapsedRealtime()
        var ready = disguised
        if (!ready) {
            lifecycleScope.launch {
                // Si Supabase tarda, se abre igual al cumplirse el tope.
                withTimeoutOrNull(SPLASH_MAX_MILLIS) { observeSession().first { it !is SessionState.Loading } }
                ready = true
            }
        }
        splash.setKeepOnScreenCondition {
            !ready && SystemClock.elapsedRealtime() - startedAt < SPLASH_MAX_MILLIS
        }
        splash.setOnExitAnimationListener { provider ->
            // Sin animación en el modo discreto o con las animaciones del sistema apagadas (reducir movimiento).
            if (disguised || isReducedMotion(this)) {
                provider.remove()
                return@setOnExitAnimationListener
            }
            // Deja terminar la animación del ícono (Android 12+) antes de la salida.
            val remaining = if (Build.VERSION.SDK_INT >= 31) {
                (provider.iconAnimationStartMillis + provider.iconAnimationDurationMillis - SystemClock.uptimeMillis())
                    .coerceIn(0L, SPLASH_ICON_MAX_MILLIS)
            } else 0L
            provider.view.postDelayed({ animateSplashExit(provider) }, remaining)
        }
    }

    /** Ícono: encoge y se desvanece; toda la pantalla de arranque se desvanece (~300 ms, curva «glass» del sistema de diseño). */
    private fun animateSplashExit(provider: SplashScreenViewProvider) {
        val glass = Interpolator { VioletEasing.Glass.transform(it) }
        provider.iconView.animate()
            .scaleX(0.85f).scaleY(0.85f).alpha(0f)
            .setDuration(SPLASH_EXIT_MILLIS).setInterpolator(glass)
            .start()
        provider.view.animate()
            .alpha(0f)
            .setDuration(SPLASH_EXIT_MILLIS).setInterpolator(glass)
            .withEndAction { provider.remove() }
            .start()
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

        /** Tope de espera de la pantalla de arranque por el estado inicial. */
        const val SPLASH_MAX_MILLIS = 1_500L

        /** Máximo que se espera a que termine la animación del ícono antes de la salida. */
        const val SPLASH_ICON_MAX_MILLIS = 900L
        const val SPLASH_EXIT_MILLIS = 300L
    }
}
