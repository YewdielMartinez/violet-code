package mx.violetcode.mobile.feature.cuenta

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import mx.violetcode.mobile.core.domain.account.AccountFailure
import mx.violetcode.mobile.core.domain.account.AccountResult
import mx.violetcode.mobile.core.domain.usecase.SignInUseCase
import mx.violetcode.mobile.core.domain.validation.RegistrationValidator

data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val showErrors: Boolean = false,
    val loading: Boolean = false,
    val failure: AccountFailure? = null,
    val signedIn: Boolean = false,
) {
    val emailError: Boolean get() = showErrors && !RegistrationValidator.isValidEmail(email)
    val passwordError: Boolean get() = showErrors && password.isEmpty()
}

class LoginViewModel(private val signIn: SignInUseCase) : ViewModel() {
    private val _state = MutableStateFlow(LoginUiState())
    val state: StateFlow<LoginUiState> = _state

    fun onEmailChange(value: String) = _state.update { it.copy(email = value, failure = null) }
    fun onPasswordChange(value: String) = _state.update { it.copy(password = value, failure = null) }

    fun submit() {
        val current = _state.value
        if (current.loading) return
        if (!RegistrationValidator.isValidEmail(current.email) || current.password.isEmpty()) {
            _state.update { it.copy(showErrors = true) }
            return
        }
        _state.update { it.copy(loading = true, failure = null) }
        viewModelScope.launch {
            when (val result = signIn(current.email, current.password)) {
                is AccountResult.Success -> _state.update { it.copy(loading = false, password = "", signedIn = true) }
                is AccountResult.Failure -> _state.update { it.copy(loading = false, failure = result.reason) }
            }
        }
    }
}
