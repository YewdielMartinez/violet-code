package mx.violetcode.mobile.feature.directorio

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import mx.violetcode.mobile.core.domain.AppError
import mx.violetcode.mobile.core.domain.Outcome
import mx.violetcode.mobile.core.domain.account.SessionState
import mx.violetcode.mobile.core.domain.model.DirectoryEntry
import mx.violetcode.mobile.core.domain.usecase.ObserveDirectoryUseCase
import mx.violetcode.mobile.core.domain.usecase.ObserveSessionUseCase
import mx.violetcode.mobile.core.domain.usecase.RefreshDirectoryUseCase

/**
 * Estado de UI inmutable. Offline-first: si hay datos guardados se muestran aunque falle la red;
 * `lastError` solo informa que no se pudo actualizar.
 */
data class DirectorioUiState(
    val entries: List<DirectoryEntry> = emptyList(),
    val isRefreshing: Boolean = false,
    val lastError: AppError? = null,
) {
    val showFullError: Boolean get() = entries.isEmpty() && lastError != null && !isRefreshing
}

private data class RefreshState(val isRefreshing: Boolean = false, val lastError: AppError? = null)

/** Sin lógica de negocio: delega en casos de uso y traduce su resultado a estado de UI. */
class DirectorioViewModel(
    observeDirectory: ObserveDirectoryUseCase,
    private val refreshDirectory: RefreshDirectoryUseCase,
    observeSession: ObserveSessionUseCase,
) : ViewModel() {

    private val refreshState = MutableStateFlow(RefreshState())
    private var refreshJob: Job? = null

    val state: StateFlow<DirectorioUiState> =
        combine(observeDirectory(), refreshState) { entries, refresh ->
            DirectorioUiState(entries, refresh.isRefreshing, refresh.lastError)
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), DirectorioUiState(isRefreshing = true))

    init {
        refresh()
        // El directorio completo exige sesión (RLS): al iniciar sesión se vuelve a pedir sin esperar a «Actualizar».
        // El primer valor se descarta: si ya había sesión, el refresh de arriba ya la usa.
        viewModelScope.launch {
            observeSession()
                .map { it is SessionState.SignedIn }
                .distinctUntilChanged()
                .drop(1)
                .filter { signedIn -> signedIn }
                .collect { refresh() }
        }
    }

    fun refresh() {
        refreshJob?.cancel()
        refreshJob = viewModelScope.launch {
            refreshState.update { it.copy(isRefreshing = true) }
            val error = (refreshDirectory() as? Outcome.Failure)?.error
            refreshState.update { RefreshState(isRefreshing = false, lastError = error) }
        }
    }
}
