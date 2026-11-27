package mx.violetcode.mobile.feature.orientacion

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import mx.violetcode.mobile.core.domain.model.DirectoryEntry
import mx.violetcode.mobile.core.domain.usecase.ObserveSupportHotlineUseCase
import mx.violetcode.mobile.core.domain.violentometro.ViolentometroItem
import mx.violetcode.mobile.core.domain.violentometro.ViolentometroSelection

/**
 * Violentómetro orientativo. Lo marcado vive SOLO en memoria (RF-26.1): no hay SavedStateHandle,
 * base de datos ni llamadas de red con las respuestas. Guardarlas exigiría consentimiento explícito.
 */
class OrientacionViewModel(observeHotline: ObserveSupportHotlineUseCase) : ViewModel() {

    private val _selection = MutableStateFlow(ViolentometroSelection())
    val selection: StateFlow<ViolentometroSelection> = _selection.asStateFlow()

    /** Línea de apoyo del directorio para ofrecerla en las zonas altas. */
    val hotline: StateFlow<DirectoryEntry?> =
        observeHotline().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun toggle(item: ViolentometroItem) = _selection.update { it.toggle(item) }

    fun setLevel(level: Int) = _selection.update { it.withManualLevel(level) }

    fun clear() = _selection.update { it.cleared() }
}
