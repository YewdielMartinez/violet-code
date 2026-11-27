package mx.violetcode.mobile.core.domain.account

/** Datos que la usuaria captura al registrarse (RF-33). La CURP ya viene normalizada (mayúsculas, sin espacios). */
data class RegistrationData(
    val email: String,
    val password: String,
    val curp: String,
    val nombres: String,
    val apellidoPaterno: String,
    val apellidoMaterno: String?,
    val celular: String?,
    val avisoPrivacidadAceptado: Boolean,
)

/** Estado de la sesión de la usuaria. No expone nada del expediente (RF-33.1). */
sealed interface SessionState {
    /** Todavía se está leyendo la sesión guardada en el teléfono. */
    data object Loading : SessionState
    data object SignedOut : SessionState
    data class SignedIn(val userId: String) : SessionState
}

/** Resultado de `AccountRepository.signUp`: siempre el mismo, exista o no la cuenta. */
enum class SignUpOutcome {
    /** Se pidió confirmar el correo (o la cuenta ya estaba lista). La pantalla muestra un mensaje genérico. */
    CheckEmail,

    /** La sesión quedó abierta de inmediato (proyecto sin confirmación de correo). */
    SignedIn,
}

/** Acuse de una alerta enviada. Sin estado interno ni datos del caso. */
data class AlertReceipt(val alertId: String)

/** Motivos de fallo ya traducidos del servidor. Ninguno revela si un correo o una CURP existen. */
enum class AccountFailure {
    Network,
    InvalidCredentials,
    EmailNotConfirmed,
    InvalidData,
    TooManyRequests,
    NotSignedIn,
    ProfileMissing,
    AlertLimitReached,
    Unexpected,
}

sealed interface AccountResult<out T> {
    data class Success<T>(val value: T) : AccountResult<T>
    data class Failure(val reason: AccountFailure) : AccountResult<Nothing>
}
