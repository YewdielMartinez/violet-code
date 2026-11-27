package mx.violetcode.mobile.core.data.supabase

import io.github.jan.supabase.auth.exception.AuthErrorCode
import io.github.jan.supabase.auth.exception.AuthRestException
import io.github.jan.supabase.exceptions.HttpRequestException
import io.github.jan.supabase.exceptions.RestException
import io.ktor.client.plugins.HttpRequestTimeoutException
import kotlinx.coroutines.CancellationException
import mx.violetcode.mobile.core.domain.account.AccountFailure
import java.io.IOException

/**
 * Traduce errores del servidor a motivos genéricos (RF-33.1): nunca se propaga texto del servidor a la
 * pantalla, porque podría revelar si un correo o una CURP ya existen o si hay un expediente ligado.
 */
internal fun Throwable.toAccountFailure(): AccountFailure {
    if (this is CancellationException) throw this
    return when (this) {
        is HttpRequestTimeoutException, is HttpRequestException, is IOException -> AccountFailure.Network
        is AuthRestException -> when (errorCode) {
            AuthErrorCode.InvalidCredentials -> AccountFailure.InvalidCredentials
            // Solo lo ve quien ya acertó la contraseña (el servidor valida la contraseña primero).
            AuthErrorCode.EmailNotConfirmed -> AccountFailure.EmailNotConfirmed
            AuthErrorCode.OverRequestRateLimit,
            AuthErrorCode.OverEmailSendRateLimit -> AccountFailure.TooManyRequests
            AuthErrorCode.WeakPassword,
            AuthErrorCode.ValidationFailed -> AccountFailure.InvalidData
            else -> if (statusCode == 429) AccountFailure.TooManyRequests else AccountFailure.Unexpected
        }
        is RestException -> when {
            statusCode == 401 || statusCode == 403 -> AccountFailure.NotSignedIn
            statusCode == 429 -> AccountFailure.TooManyRequests
            else -> AccountFailure.Unexpected
        }
        else -> AccountFailure.Unexpected
    }
}
