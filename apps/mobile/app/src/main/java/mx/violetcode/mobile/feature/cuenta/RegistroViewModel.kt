package mx.violetcode.mobile.feature.cuenta

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import mx.violetcode.mobile.core.domain.account.AccountFailure
import mx.violetcode.mobile.core.domain.account.AccountResult
import mx.violetcode.mobile.core.domain.account.RegistrationData
import mx.violetcode.mobile.core.domain.account.SignUpOutcome
import mx.violetcode.mobile.core.domain.usecase.SignUpUseCase
import mx.violetcode.mobile.core.domain.validation.RegistrationValidator as V

data class RegistroUiState(
    val email: String = "",
    val password: String = "",
    val curp: String = "",
    val nombres: String = "",
    val apellidoPaterno: String = "",
    val apellidoMaterno: String = "",
    val celular: String = "",
    val avisoAceptado: Boolean = false,
    val showErrors: Boolean = false,
    val loading: Boolean = false,
    val failure: AccountFailure? = null,
    /** Resultado final. Siempre el mismo mensaje exista o no el correo/CURP (RF-33.1). */
    val outcome: SignUpOutcome? = null,
) {
    val emailError get() = showErrors && !V.isValidEmail(email)
    val passwordError get() = showErrors && !V.isValidPassword(password)
    val curpError get() = showErrors && !V.isValidCurp(curp)
    val nombresError get() = showErrors && !V.isValidName(nombres)
    val paternoError get() = showErrors && !V.isValidName(apellidoPaterno)
    val maternoError get() = showErrors && apellidoMaterno.isNotBlank() && !V.isValidName(apellidoMaterno)
    val celularError get() = showErrors && !V.isValidCelular(celular)
    val avisoError get() = showErrors && !avisoAceptado

    val isValid: Boolean
        get() = V.isValidEmail(email) && V.isValidPassword(password) && V.isValidCurp(curp) &&
            V.isValidName(nombres) && V.isValidName(apellidoPaterno) &&
            (apellidoMaterno.isBlank() || V.isValidName(apellidoMaterno)) &&
            V.isValidCelular(celular) && avisoAceptado
}

class RegistroViewModel(private val signUp: SignUpUseCase) : ViewModel() {
    private val _state = MutableStateFlow(RegistroUiState())
    val state: StateFlow<RegistroUiState> = _state

    fun onEmail(v: String) = _state.update { it.copy(email = v, failure = null) }
    fun onPassword(v: String) = _state.update { it.copy(password = v, failure = null) }
    fun onCurp(v: String) = _state.update { it.copy(curp = v.filterNot(Char::isWhitespace).uppercase().take(18), failure = null) }
    fun onNombres(v: String) = _state.update { it.copy(nombres = v.take(V.MAX_NAME_LENGTH), failure = null) }
    fun onPaterno(v: String) = _state.update { it.copy(apellidoPaterno = v.take(V.MAX_NAME_LENGTH), failure = null) }
    fun onMaterno(v: String) = _state.update { it.copy(apellidoMaterno = v.take(V.MAX_NAME_LENGTH), failure = null) }
    fun onCelular(v: String) = _state.update { it.copy(celular = v.filter(Char::isDigit).take(10), failure = null) }
    fun onAviso(v: Boolean) = _state.update { it.copy(avisoAceptado = v, failure = null) }

    fun submit() {
        val s = _state.value
        if (s.loading) return
        if (!s.isValid) {
            _state.update { it.copy(showErrors = true) }
            return
        }
        _state.update { it.copy(loading = true, failure = null) }
        viewModelScope.launch {
            val result = signUp(
                RegistrationData(
                    email = s.email,
                    password = s.password,
                    curp = s.curp,
                    nombres = s.nombres,
                    apellidoPaterno = s.apellidoPaterno,
                    apellidoMaterno = s.apellidoMaterno.ifBlank { null },
                    celular = s.celular.ifBlank { null },
                    avisoPrivacidadAceptado = s.avisoAceptado,
                ),
            )
            when (result) {
                is AccountResult.Success ->
                    // La contraseña y la CURP no se conservan en memoria de la pantalla.
                    _state.update { RegistroUiState(outcome = result.value) }
                is AccountResult.Failure -> _state.update { it.copy(loading = false, failure = result.reason) }
            }
        }
    }
}
