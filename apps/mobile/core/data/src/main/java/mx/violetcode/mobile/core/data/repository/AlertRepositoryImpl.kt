package mx.violetcode.mobile.core.data.repository

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.exception.PostgrestRestException
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import mx.violetcode.mobile.core.data.supabase.toAccountFailure
import mx.violetcode.mobile.core.domain.account.AccountFailure
import mx.violetcode.mobile.core.domain.account.AccountResult
import mx.violetcode.mobile.core.domain.account.AlertReceipt
import mx.violetcode.mobile.core.domain.account.AlertRepository

/**
 * RF-18: llama al RPC `enviar_alerta` (migración 46). El cliente NO manda prioridad, persona_id ni
 * pre_registro_id: el servidor toma el pre-registro de la sesión (`mi_pre_registro_id()`), fija
 * `origen = 'app_movil'`, calcula la prioridad con su trigger y limita a 3 alertas por hora.
 */
internal class AlertRepositoryImpl(private val client: SupabaseClient) : AlertRepository {

    override suspend fun sendHelpAlert(): AccountResult<AlertReceipt> = try {
        val row = client.postgrest.rpc("enviar_alerta").decodeList<AlertaDto>().firstOrNull()
        if (row == null) AccountResult.Failure(AccountFailure.Unexpected)
        else AccountResult.Success(AlertReceipt(row.alertaId))
    } catch (e: PostgrestRestException) {
        // SQLSTATE 23514 para "sin perfil" y para "límite alcanzado": se distinguen por el texto.
        val text = e.message.orEmpty()
        AccountResult.Failure(
            when {
                text.contains("límite", ignoreCase = true) -> AccountFailure.AlertLimitReached
                text.contains("perfil", ignoreCase = true) -> AccountFailure.ProfileMissing
                else -> e.toAccountFailure()
            },
        )
    } catch (e: Exception) {
        AccountResult.Failure(e.toAccountFailure())
    }
}

@Serializable
internal data class AlertaDto(
    @SerialName("alerta_id") val alertaId: String,
)
