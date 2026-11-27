package mx.violetcode.mobile.feature.auxilio

import mx.violetcode.mobile.core.domain.account.AccountFailure

/** Mensaje tranquilo cuando el servidor limita las alertas (3 por hora). Incluye la salida segura: el 911. */
internal const val ALERT_LIMIT_MESSAGE =
    "Ya enviaste varias solicitudes en la última hora. Si estás en peligro, llama al 911."

/** Mensajes genéricos: no detallan datos del servidor. */
internal fun AccountFailure.helpMessage(): String = when (this) {
    AccountFailure.NotSignedIn -> "Tu sesión terminó. Inicia sesión para enviar la alerta."
    AccountFailure.Network -> "No hay conexión. La alerta no se envió."
    AccountFailure.AlertLimitReached -> ALERT_LIMIT_MESSAGE
    AccountFailure.ProfileMissing -> "Tu cuenta aún no está lista. Inicia sesión de nuevo e inténtalo."
    else -> "No se pudo enviar la alerta."
}
