package mx.violetcode.mobile.feature.perfil

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import mx.violetcode.mobile.core.domain.account.ProfileState
import mx.violetcode.mobile.core.domain.usecase.ObserveMyProfileUseCase
import mx.violetcode.mobile.core.domain.usecase.SignOutUseCase

data class PerfilUiState(
    val profile: ProfileState = ProfileState.Loading,
    val signingOut: Boolean = false,
)

/**
 * «Mi perfil» y la tarjeta de cuenta de Ajustes. El perfil solo vive en memoria y sigue a la sesión:
 * al cerrar sesión pasa a `SignedOut` y desaparece.
 */
class PerfilViewModel(
    observeProfile: ObserveMyProfileUseCase,
    private val signOutUseCase: SignOutUseCase,
) : ViewModel() {

    private val retry = MutableStateFlow(0)
    private val signingOut = MutableStateFlow(false)

    val state: StateFlow<PerfilUiState> =
        combine(observeProfile(retry), signingOut) { profile, out -> PerfilUiState(profile, out) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), PerfilUiState())

    /** Vuelve a leer el perfil (tras un error de red). */
    fun retry() = retry.update { it + 1 }

    fun signOut() {
        if (signingOut.value) return
        signingOut.value = true
        viewModelScope.launch {
            try {
                signOutUseCase()
            } finally {
                signingOut.value = false
            }
        }
    }
}
