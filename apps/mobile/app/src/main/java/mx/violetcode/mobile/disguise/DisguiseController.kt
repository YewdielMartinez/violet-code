package mx.violetcode.mobile.disguise

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.os.SystemClock
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import mx.violetcode.mobile.core.domain.disguise.PinCheck
import mx.violetcode.mobile.core.domain.disguise.PinGate
import mx.violetcode.mobile.core.domain.disguise.PinPolicy

/**
 * Modo discreto: mientras esté activo y bloqueado, MainActivity muestra SOLO la calculadora.
 * El estado «desbloqueado» vive únicamente en memoria: si el proceso muere, al volver pide el PIN.
 *
 * - Sin modo discreto: siempre desbloqueado y [lock] no hace nada.
 * - Con modo discreto: [lock] (salir rápido, segundo plano, inactividad) regresa a la calculadora.
 */
class DisguiseController(
    private val context: Context,
    private val store: DisguiseStore,
    private val gate: PinGate,
) {
    private val _enabled = MutableStateFlow(store.enabled && gate.isConfigured)
    val enabled: StateFlow<Boolean> = _enabled.asStateFlow()

    /** `true` cuando hay que mostrar la calculadora en vez de la app. Al abrir el proceso, con modo discreto, arranca en `true`. */
    private val _showCalculator = MutableStateFlow(_enabled.value)
    val showCalculator: StateFlow<Boolean> = _showCalculator.asStateFlow()

    private var lastInteraction = SystemClock.elapsedRealtime()

    var neutralSiteOnExit: Boolean
        get() = store.neutralSiteOnExit
        set(value) {
            store.neutralSiteOnExit = value
        }

    init {
        // Reconcilia el ícono del launcher con lo guardado (p. ej. tras actualizar la app).
        applyLauncherAlias(_enabled.value)
    }

    /** Activa el modo discreto con un PIN nuevo. La usuaria ya está dentro, así que sigue desbloqueada. */
    fun enable(pin: String): Boolean {
        if (!PinPolicy.isValidFormat(pin)) return false
        gate.setPin(pin)
        store.enabled = true
        _enabled.value = true
        _showCalculator.value = false
        lastInteraction = SystemClock.elapsedRealtime()
        // El ícono se cambia al salir de la app (ver syncLauncher): cambiarlo con la app abierta la cierra.
        return true
    }

    fun changePin(pin: String): Boolean {
        if (!_enabled.value || !PinPolicy.isValidFormat(pin)) return false
        gate.setPin(pin)
        return true
    }

    /** Desactiva el modo discreto: borra el PIN y devuelve el ícono normal. */
    fun disable() {
        gate.clear()
        store.enabled = false
        _enabled.value = false
        _showCalculator.value = false
    }

    /** Llamado por la calculadora al pulsar «=» con un posible PIN. Es lento a propósito (PBKDF2). */
    fun tryUnlock(pin: String): PinCheck {
        val result = gate.check(pin)
        if (result == PinCheck.Correct) {
            lastInteraction = SystemClock.elapsedRealtime()
            _showCalculator.value = false
        }
        return result
    }

    /** Vuelve a la calculadora (salir rápido, segundo plano, inactividad). Sin modo discreto no hace nada. */
    fun lock() {
        if (_enabled.value) _showCalculator.value = true
    }

    fun onUserInteraction() {
        lastInteraction = SystemClock.elapsedRealtime()
    }

    /** Bloquea si pasaron [IDLE_TIMEOUT_MILLIS] sin tocar la pantalla. */
    fun lockIfIdle() {
        if (_enabled.value && !_showCalculator.value &&
            SystemClock.elapsedRealtime() - lastInteraction >= IDLE_TIMEOUT_MILLIS
        ) lock()
    }

    /**
     * Alinea el ícono/nombre del launcher con el modo actual. Se llama al salir de la app (`onStop`): al
     * deshabilitar el alias con el que se abrió, Android quita esa tarea, así que no se hace con la app a la vista.
     */
    fun syncLauncher() = applyLauncherAlias(_enabled.value)

    private fun applyLauncherAlias(disguised: Boolean) {
        val pm = context.packageManager
        val normal = ComponentName(context.packageName, "$ALIAS_PACKAGE.LauncherNormal")
        val calculator = ComponentName(context.packageName, "$ALIAS_PACKAGE.LauncherCalculator")
        // Se enciende primero el nuevo y luego se apaga el anterior: nunca se queda sin ícono.
        if (disguised) {
            setAlias(pm, calculator, true)
            setAlias(pm, normal, false)
        } else {
            setAlias(pm, normal, true)
            setAlias(pm, calculator, false)
        }
    }

    private fun setAlias(pm: PackageManager, component: ComponentName, enabled: Boolean) {
        val state = if (enabled) PackageManager.COMPONENT_ENABLED_STATE_ENABLED else PackageManager.COMPONENT_ENABLED_STATE_DISABLED
        if (pm.getComponentEnabledSetting(component) != state) {
            pm.setComponentEnabledSetting(component, state, PackageManager.DONT_KILL_APP)
        }
    }

    companion object {
        const val IDLE_TIMEOUT_MILLIS = 2 * 60_000L

        /** Namespace de la app: los alias del manifest (`.LauncherNormal`) se resuelven contra él, no contra el applicationId. */
        private const val ALIAS_PACKAGE = "mx.violetcode.mobile"
    }
}
