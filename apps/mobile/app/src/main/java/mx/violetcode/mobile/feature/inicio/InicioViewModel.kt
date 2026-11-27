package mx.violetcode.mobile.feature.inicio

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import mx.violetcode.mobile.core.domain.account.ProfileState
import mx.violetcode.mobile.core.domain.usecase.ObserveMyProfileUseCase

/** Solo expone el primer nombre (saludo discreto); `null` sin sesión o mientras no se conozca. */
class InicioViewModel(observeProfile: ObserveMyProfileUseCase) : ViewModel() {
    val firstName: StateFlow<String?> = observeProfile()
        .map { (it as? ProfileState.Ready)?.profile?.firstName?.takeIf { name -> name.isNotEmpty() } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
}
