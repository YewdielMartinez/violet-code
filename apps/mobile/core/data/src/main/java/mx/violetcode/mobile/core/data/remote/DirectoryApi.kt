package mx.violetcode.mobile.core.data.remote

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.GET

/** Espejo de `public.directorio_institucion` vía PostgREST de Supabase. Solo vive en `core:data`. */
@Serializable
internal data class SupabaseDirectoryDto(
    val id: Int,
    val nombre: String,
    val categoria: String,
    val telefono: String,
    val horario: String? = null,
    @SerialName("es_24_horas") val es24Horas: Boolean = false,
    val calle: String? = null,
    @SerialName("numero_exterior") val numeroExterior: String? = null,
    @SerialName("codigo_postal") val codigoPostal: String? = null,
    val orden: Int = 0,
)

internal interface DirectoryApi {
    @GET("rest/v1/directorio_institucion?select=id,nombre,categoria,telefono,horario,es_24_horas,calle,numero_exterior,codigo_postal,orden&activo=eq.true&order=orden.asc,nombre.asc")
    suspend fun list(): List<SupabaseDirectoryDto>
}
