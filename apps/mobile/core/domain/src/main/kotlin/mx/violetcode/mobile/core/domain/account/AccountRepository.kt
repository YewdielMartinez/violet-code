package mx.violetcode.mobile.core.domain.account

import kotlinx.coroutines.flow.StateFlow

/** Cuenta de la usuaria (Supabase Auth + perfil de pre-registro). La implementación vive en core:data. */
interface AccountRepository {
    val session: StateFlow<SessionState>

    /**
     * Crea la cuenta. Con confirmación de correo activa NO hay sesión todavía: el perfil se completa al
     * primer inicio de sesión ([ensureProfile]). La respuesta es la misma exista o no el correo (RF-33.1).
     */
    suspend fun signUp(data: RegistrationData): AccountResult<SignUpOutcome>

    suspend fun signIn(email: String, password: String): AccountResult<Unit>

    suspend fun signOut()

    /**
     * Si la cuenta aún no tiene perfil y quedaron datos de registro pendientes, los envía a
     * `registrar_mi_perfil`. Devuelve `true` si la cuenta ya tiene perfil al terminar.
     */
    suspend fun ensureProfile(): AccountResult<Boolean>
}

/** Botón de ayuda (RF-18). El servidor decide prioridad, persona y límite de envíos. */
interface AlertRepository {
    suspend fun sendHelpAlert(): AccountResult<AlertReceipt>
}
