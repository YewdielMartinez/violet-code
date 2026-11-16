package mx.violetcode.mobile.core.domain.model

/** Instancia de atención o Punto Violeta. Modelo de dominio: sin anotaciones de framework. */
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
)

enum class EntryKind { Institution, VioletPoint }

data class GeoPoint(val latitude: Double, val longitude: Double)
