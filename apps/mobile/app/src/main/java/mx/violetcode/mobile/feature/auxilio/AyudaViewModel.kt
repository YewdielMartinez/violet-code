package mx.violetcode.mobile.feature.auxilio

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import mx.violetcode.mobile.core.domain.account.AccountFailure
import mx.violetcode.mobile.core.domain.account.AccountResult
import mx.violetcode.mobile.core.domain.account.SessionState
import mx.violetcode.mobile.core.domain.usecase.ObserveSessionUseCase
import mx.violetcode.mobile.core.domain.usecase.SendHelpAlertUseCase

/** Fase del botón de ayuda (RF-18 / RF-18.1). */
sealed interface AyudaPhase {
    data object Idle : AyudaPhase

    /** Cuenta regresiva visible; la usuaria puede cancelar. */
    data class Countdown(val secondsLeft: Int) : AyudaPhase
    data object Sending : AyudaPhase
    data object Sent : AyudaPhase
    data class Failed(val reason: AccountFailure) : AyudaPhase
}

data class AyudaUiState(
    val session: SessionState = SessionState.Loading,
    val phase: AyudaPhase = AyudaPhase.Idle,
)

/**
 * Orquesta: mantener 2 s (lo hace el componente) → cuenta regresiva de [COUNTDOWN_SECONDS] s con cancelación
 * → envío. Nada se envía si la usuaria cancela. Sin sesión no se arranca la cuenta (se guía a iniciar sesión).
 */
class AyudaViewModel(
    observeSession: ObserveSessionUseCase,
    private val sendHelpAlert: SendHelpAlertUseCase,
) : ViewModel() {

    private val phase = MutableStateFlow<AyudaPhase>(AyudaPhase.Idle)
    private var countdownJob: Job? = null

    val state: StateFlow<AyudaUiState> =
        combine(observeSession(), phase) { session, phase -> AyudaUiState(session, phase) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AyudaUiState())

    fun startCountdown() {
        if (state.value.session !is SessionState.SignedIn) return
        if (phase.value is AyudaPhase.Countdown || phase.value is AyudaPhase.Sending) return
        countdownJob = viewModelScope.launch {
            for (left in COUNTDOWN_SECONDS downTo 1) {
                phase.value = AyudaPhase.Countdown(left)
                delay(1_000)
            }
            phase.value = AyudaPhase.Sending
            phase.value = when (val result = sendHelpAlert()) {
                is AccountResult.Success -> AyudaPhase.Sent
                is AccountResult.Failure -> AyudaPhase.Failed(result.reason)
            }
        }
    }

    fun cancel() {
        if (phase.value is AyudaPhase.Countdown) {
            countdownJob?.cancel()
            phase.value = AyudaPhase.Idle
        }
    }

    fun dismiss() = phase.update { if (it is AyudaPhase.Sent || it is AyudaPhase.Failed) AyudaPhase.Idle else it }

    companion object {
        const val COUNTDOWN_SECONDS = 5
        const val HOLD_MILLIS = 2_000
    }
}
