package mx.violetcode.mobile.core.domain.model

/**
 * Instancia de atención o Punto Violeta. Modelo de dominio: sin anotaciones de framework.
 *
 * Seguridad: [address] es el domicilio público de dependencias abiertas. Para refugios
 * (`category == "refugio"`) NUNCA debe existir: la BD lo prohíbe y la capa de datos lo descarta.
 */
data class DirectoryEntry(
    val id: String,
    val kind: EntryKind,
    val name: String,
    val description: String?,
    val phone: String?,
    val address: String?,
    val schedule: String?,
    val location: GeoPoint?,
    val isEmergency: Boolean,
    /** Clave de `categoria_institucion` (emergencia, linea_apoyo, refugio…). */
    val category: String? = null,
) {
    companion object {
        const val CATEGORY_SUPPORT_LINE = "linea_apoyo"
        const val CATEGORY_SHELTER = "refugio"
    }
}

enum class EntryKind { Institution, VioletPoint }

data class GeoPoint(val latitude: Double, val longitude: Double)
