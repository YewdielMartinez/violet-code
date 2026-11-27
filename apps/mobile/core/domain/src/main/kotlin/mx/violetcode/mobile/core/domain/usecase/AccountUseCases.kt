package mx.violetcode.mobile.core.domain.usecase

import mx.violetcode.mobile.core.domain.account.AccountFailure
import mx.violetcode.mobile.core.domain.account.AccountRepository
import mx.violetcode.mobile.core.domain.account.AccountResult
import mx.violetcode.mobile.core.domain.account.AlertReceipt
import mx.violetcode.mobile.core.domain.account.AlertRepository
import mx.violetcode.mobile.core.domain.account.RegistrationData
import mx.violetcode.mobile.core.domain.account.SessionState
import mx.violetcode.mobile.core.domain.account.SignUpOutcome
import mx.violetcode.mobile.core.domain.validation.RegistrationValidator

/** Valida la captura y crea la cuenta. Un dato inválido nunca llega al servidor. */
class SignUpUseCase(private val accounts: AccountRepository) {
    suspend operator fun invoke(data: RegistrationData): AccountResult<SignUpOutcome> {
        val v = RegistrationValidator
        val materno = data.apellidoMaterno?.trim().orEmpty()
        val valid = v.isValidEmail(data.email) &&
            v.isValidPassword(data.password) &&
            v.isValidCurp(data.curp) &&
            v.isValidName(data.nombres) &&
            v.isValidName(data.apellidoPaterno) &&
            (materno.isEmpty() || v.isValidName(materno)) &&
            v.isValidCelular(data.celular.orEmpty()) &&
            data.avisoPrivacidadAceptado
        if (!valid) return AccountResult.Failure(AccountFailure.InvalidData)
        return accounts.signUp(
            data.copy(
                email = data.email.trim(),
                curp = v.normalizeCurp(data.curp),
                nombres = data.nombres.trim(),
                apellidoPaterno = data.apellidoPaterno.trim(),
                apellidoMaterno = materno.ifEmpty { null },
                celular = data.celular?.takeIf { it.isNotEmpty() },
            ),
        )
    }
}

/** Inicia sesión y, si quedó un registro pendiente de confirmar por correo, completa el perfil. */
class SignInUseCase(private val accounts: AccountRepository) {
    suspend operator fun invoke(email: String, password: String): AccountResult<Unit> {
        if (!RegistrationValidator.isValidEmail(email) || password.isEmpty()) {
            return AccountResult.Failure(AccountFailure.InvalidCredentials)
        }
        val result = accounts.signIn(email.trim(), password)
        if (result is AccountResult.Success) accounts.ensureProfile() // mejor esfuerzo: se reintenta al enviar alerta
        return result
    }
}

class SignOutUseCase(private val accounts: AccountRepository) {
    suspend operator fun invoke() = accounts.signOut()
}

class ObserveSessionUseCase(private val accounts: AccountRepository) {
    operator fun invoke() = accounts.session
}

/**
 * RF-18: envía la alerta del botón de ayuda. Exige sesión; si el perfil quedó pendiente lo completa primero.
 * Prioridad, persona y límite por hora los fija el servidor.
 */
class SendHelpAlertUseCase(
    private val accounts: AccountRepository,
    private val alerts: AlertRepository,
) {
    suspend operator fun invoke(): AccountResult<AlertReceipt> {
        if (accounts.session.value !is SessionState.SignedIn) {
            return AccountResult.Failure(AccountFailure.NotSignedIn)
        }
        return when (val profile = accounts.ensureProfile()) {
            is AccountResult.Failure -> profile
            is AccountResult.Success ->
                if (profile.value) alerts.sendHelpAlert() else AccountResult.Failure(AccountFailure.ProfileMissing)
        }
    }
}
