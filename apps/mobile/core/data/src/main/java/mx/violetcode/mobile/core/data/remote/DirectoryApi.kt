package mx.violetcode.mobile.core.data.remote

import kotlinx.serialization.Serializable
import retrofit2.http.GET

/** Espejo de DirectoryEntryDto (Core · módulo Catalogs). Solo vive en la capa de datos. */
@Serializable
internal data class DirectoryEntryDto(
    val id: String,
    val kind: String,
    val name: String,
    val description: String? = null,
    val phone: String? = null,
    val address: String? = null,
    val schedule: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val isEmergency: Boolean = false,
)

internal interface DirectoryApi {
    @GET("api/catalogs/directory")
    suspend fun list(): List<DirectoryEntryDto>
}
