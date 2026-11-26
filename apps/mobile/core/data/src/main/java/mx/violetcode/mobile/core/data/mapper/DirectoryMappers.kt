package mx.violetcode.mobile.core.data.mapper

import mx.violetcode.mobile.core.data.local.DirectoryEntryEntity
import mx.violetcode.mobile.core.data.remote.SupabaseDirectoryDto
import mx.violetcode.mobile.core.domain.model.DirectoryEntry
import mx.violetcode.mobile.core.domain.model.EntryKind
import mx.violetcode.mobile.core.domain.model.GeoPoint

private val CATEGORY_LABELS = mapOf(
    "emergencia" to "Emergencia",
    "denuncia" to "Denuncia",
    "orientacion_legal" to "Orientación legal",
    "atencion_psicologica" to "Atención psicológica",
    "trabajo_social" to "Trabajo social",
    "refugio" to "Refugio",
    "salud" to "Salud",
    "linea_apoyo" to "Línea de apoyo",
)

internal fun SupabaseDirectoryDto.toEntity(): DirectoryEntryEntity {
    // Seguridad: nunca exponer domicilio de refugios confidenciales.
    val formattedAddress = if (categoria == "refugio") {
        null
    } else {
        listOfNotNull(calle, numeroExterior, codigoPostal)
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .joinToString(", ")
            .ifEmpty { null }
    }

    return DirectoryEntryEntity(
        id = id.toString(),
        kind = EntryKind.Institution.name,
        name = nombre,
        description = CATEGORY_LABELS[categoria],
        phone = telefono,
        address = formattedAddress,
        schedule = horario,
        latitude = null,
        longitude = null,
        isEmergency = es24Horas || categoria == "emergencia",
    )
}

/** null si la fila local contiene un tipo desconocido por esta versión de la app. */
internal fun DirectoryEntryEntity.toDomainOrNull(): DirectoryEntry? {
    val entryKind = EntryKind.entries.firstOrNull { it.name == kind } ?: return null
    return DirectoryEntry(
        id = id,
        kind = entryKind,
        name = name,
        description = description,
        phone = phone,
        address = address,
        schedule = schedule,
        location = if (latitude != null && longitude != null) GeoPoint(latitude, longitude) else null,
        isEmergency = isEmergency,
    )
}
