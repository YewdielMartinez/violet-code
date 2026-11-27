package mx.violetcode.mobile.core.data.repository

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.exception.AuthErrorCode
import io.github.jan.supabase.auth.exception.AuthRestException
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.put
import mx.violetcode.mobile.core.data.supabase.toAccountFailure
import mx.violetcode.mobile.core.domain.account.AccountFailure
import mx.violetcode.mobile.core.domain.account.AccountRepository
import mx.violetcode.mobile.core.domain.account.AccountResult
import mx.violetcode.mobile.core.domain.account.RegistrationData
import mx.violetcode.mobile.core.domain.account.SessionState
import mx.violetcode.mobile.core.domain.account.SignUpOutcome

/**
 * Cuenta de la usuaria sobre Supabase Auth + RPC `get_mi_estado_app` / `registrar_mi_perfil` (migraciones 45).
 *
 * Flujo con confirmación de correo (enable_confirmations = true): `signUp` no abre sesión; los datos del
 * perfil viajan en `user_metadata` y, al primer inicio de sesión, [ensureProfile] los manda a
 * `registrar_mi_perfil` (que exige sesión). El servidor liga por CURP al expediente sin que la app lo sepa.
 */
internal class AccountRepositoryImpl(
    private val client: SupabaseClient,
    scope: CoroutineScope,
) : AccountRepository {

    private val profileLock = Mutex()

    override val session: StateFlow<SessionState> = client.auth.sessionStatus
        .map { status ->
            when (status) {
                is SessionStatus.Initializing -> SessionState.Loading
                is SessionStatus.Authenticated -> SessionState.SignedIn(status.session.user?.id.orEmpty())
                // Sin red al arrancar: la sesión guardada sigue siendo válida.
                is SessionStatus.RefreshFailure ->
                    client.auth.currentUserOrNull()?.let { SessionState.SignedIn(it.id) } ?: SessionState.SignedOut
                is SessionStatus.NotAuthenticated -> SessionState.SignedOut
            }
        }
        .stateIn(scope, SharingStarted.Eagerly, SessionState.Loading)

    override suspend fun signUp(data: RegistrationData): AccountResult<SignUpOutcome> = try {
        client.auth.signUpWith(Email) {
            email = data.email
            password = data.password
            this.data = buildJsonObject {
                put("curp", data.curp)
                put("nombres", data.nombres)
                put("apellido_paterno", data.apellidoPaterno)
                data.apellidoMaterno?.let { put("apellido_materno", it) }
                data.celular?.let { put("celular", it) }
                put("aviso_privacidad_aceptado", data.avisoPrivacidadAceptado)
            }
        }
        if (client.auth.currentSessionOrNull() != null) {
            ensureProfile()
            AccountResult.Success(SignUpOutcome.SignedIn)
        } else {
            AccountResult.Success(SignUpOutcome.CheckEmail)
        }
    } catch (e: AuthRestException) {
        // RF-33.1: "correo ya registrado" se responde igual que un alta nueva.
        if (e.errorCode == AuthErrorCode.UserAlreadyExists || e.errorCode == AuthErrorCode.EmailExists) {
            AccountResult.Success(SignUpOutcome.CheckEmail)
        } else {
            AccountResult.Failure(e.toAccountFailure())
        }
    } catch (e: Exception) {
        AccountResult.Failure(e.toAccountFailure())
    }

    override suspend fun signIn(email: String, password: String): AccountResult<Unit> = try {
        client.auth.signInWith(Email) {
            this.email = email
            this.password = password
        }
        AccountResult.Success(Unit)
    } catch (e: Exception) {
        AccountResult.Failure(e.toAccountFailure())
    }

    override suspend fun signOut() {
        try {
            client.auth.signOut()
        } catch (e: Exception) {
            // Sin red: igual se descarta la sesión local.
            client.auth.clearSession()
        }
    }

    override suspend fun ensureProfile(): AccountResult<Boolean> = profileLock.withLock {
        val user = client.auth.currentUserOrNull() ?: return@withLock AccountResult.Failure(AccountFailure.NotSignedIn)
        try {
            val estado = client.postgrest.rpc("get_mi_estado_app").decodeList<EstadoAppDto>().firstOrNull()
            if (estado?.tienePerfil == true) return@withLock AccountResult.Success(true)

            val meta = user.userMetadata ?: return@withLock AccountResult.Success(false)
            val curp = meta.text("curp")
            val nombres = meta.text("nombres")
            val paterno = meta.text("apellido_paterno")
            if (curp == null || nombres == null || paterno == null) return@withLock AccountResult.Success(false)

            client.postgrest.rpc(
                "registrar_mi_perfil",
                buildJsonObject {
                    put("p_curp", curp)
                    put("p_nombres", nombres)
                    put("p_apellido_paterno", paterno)
                    put("p_apellido_materno", meta.text("apellido_materno")?.let(::JsonPrimitive) ?: JsonNull)
                    put("p_celular", meta.text("celular")?.let(::JsonPrimitive) ?: JsonNull)
                    put("p_aviso_privacidad_aceptado", meta["aviso_privacidad_aceptado"]
                        ?.let { (it as? JsonPrimitive)?.booleanOrNull } ?: false)
                },
            )
            clearPendingProfileData()
            AccountResult.Success(true)
        } catch (e: Exception) {
            AccountResult.Failure(e.toAccountFailure())
        }
    }

    /** Borra del `user_metadata` los datos del registro ya consumidos (la CURP no debe quedarse ahí). */
    private suspend fun clearPendingProfileData() {
        try {
            client.auth.updateUser {
                data = buildJsonObject {
                    listOf("curp", "nombres", "apellido_paterno", "apellido_materno", "celular", "aviso_privacidad_aceptado")
                        .forEach { put(it, JsonNull) }
                }
            }
        } catch (e: Exception) {
            // Mejor esfuerzo: el perfil ya quedó creado.
        }
    }

    private fun JsonObject.text(key: String): String? =
        (this[key] as? JsonPrimitive)?.takeIf { it.isString }?.contentOrNull?.takeIf { it.isNotBlank() }
}

@Serializable
internal data class EstadoAppDto(
    @SerialName("tiene_perfil") val tienePerfil: Boolean = false,
)
