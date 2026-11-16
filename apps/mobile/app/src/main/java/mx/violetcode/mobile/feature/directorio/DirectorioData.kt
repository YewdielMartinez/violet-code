package mx.violetcode.mobile.feature.directorio

import kotlinx.serialization.Serializable
import mx.violetcode.mobile.data.network.ApiClient
import retrofit2.http.GET

/** Espejo de DirectoryEntryDto (Core · módulo Catalogs). */
@Serializable
data class DirectoryEntry(
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

interface DirectoryApi {
    @GET("api/catalogs/directory")
    suspend fun list(): List<DirectoryEntry>
}

/**
 * Repositorio del directorio.
 * Pendiente: caché local (Room/DataStore) para uso sin conexión (requisito "directorio offline").
 */
class DirectoryRepository(private val api: DirectoryApi = ApiClient.create()) {
    suspend fun entries(): Result<List<DirectoryEntry>> = runCatching { api.list() }
}
