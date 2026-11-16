package mx.violetcode.mobile.feature.directorio

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import mx.violetcode.mobile.core.domain.AppError
import mx.violetcode.mobile.core.domain.Outcome
import mx.violetcode.mobile.core.domain.model.DirectoryEntry
import mx.violetcode.mobile.core.domain.usecase.ObserveDirectoryUseCase
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
) : ViewModel() {

    private val refreshState = MutableStateFlow(RefreshState())

    val state: StateFlow<DirectorioUiState> =
        combine(observeDirectory(), refreshState) { entries, refresh ->
            DirectorioUiState(entries, refresh.isRefreshing, refresh.lastError)
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), DirectorioUiState(isRefreshing = true))

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            refreshState.update { it.copy(isRefreshing = true) }
            val error = (refreshDirectory() as? Outcome.Failure)?.error
            refreshState.update { RefreshState(isRefreshing = false, lastError = error) }
        }
    }
}
