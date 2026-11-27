package mx.violetcode.mobile.core.data.mapper

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import mx.violetcode.mobile.core.domain.account.UserProfile

/** Fila de `get_mi_pre_registro()`. El servidor no manda `persona_id` ni `estado`: la app no sabe si hay expediente. */
@Serializable
internal data class MiPreRegistroDto(
    val curp: String = "",
    val nombres: String = "",
    @SerialName("apellido_paterno") val apellidoPaterno: String = "",
    @SerialName("apellido_materno") val apellidoMaterno: String? = null,
    val celular: String? = null,
)

internal fun MiPreRegistroDto.toDomain(email: String?): UserProfile = UserProfile(
    nombres = nombres.trim(),
    apellidoPaterno = apellidoPaterno.trim(),
    apellidoMaterno = apellidoMaterno?.trim()?.takeIf { it.isNotEmpty() },
    email = email?.trim()?.takeIf { it.isNotEmpty() },
    curp = curp.trim(),
    celular = celular?.trim()?.takeIf { it.isNotEmpty() },
)
