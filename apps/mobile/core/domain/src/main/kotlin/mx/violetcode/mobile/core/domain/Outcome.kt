package mx.violetcode.mobile.core.domain

/** Resultado de una operación del dominio. Los errores son tipados: la UI decide el mensaje. */
sealed interface Outcome<out T> {
    data class Success<T>(val value: T) : Outcome<T>
    data class Failure(val error: AppError) : Outcome<Nothing>
}

sealed interface AppError {
    /** Sin conexión o tiempo de espera agotado. */
    data object Network : AppError

    /** Sesión inválida o expirada. */
    data object Unauthorized : AppError

    /** El servidor respondió con error. */
    data class Server(val code: Int) : AppError

    /** Respuesta inesperada (contrato roto, datos corruptos). */
    data object Unexpected : AppError
}
