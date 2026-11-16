package mx.violetcode.mobile.feature.directorio

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Estado de UI inmutable: la pantalla solo lo dibuja (MVVM, flujo unidireccional). */
sealed interface DirectorioUiState {
    data object Loading : DirectorioUiState
    data class Ready(val entries: List<DirectoryEntry>) : DirectorioUiState
    data object Error : DirectorioUiState
}

class DirectorioViewModel(
    private val repository: DirectoryRepository = DirectoryRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow<DirectorioUiState>(DirectorioUiState.Loading)
    val state: StateFlow<DirectorioUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.value = DirectorioUiState.Loading
        viewModelScope.launch {
            _state.value = repository.entries().fold(
                onSuccess = { DirectorioUiState.Ready(it) },
                onFailure = { DirectorioUiState.Error },
            )
        }
    }
}
