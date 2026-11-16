package mx.violetcode.mobile.core.data.mapper

import mx.violetcode.mobile.core.data.local.DirectoryEntryEntity
import mx.violetcode.mobile.core.data.remote.DirectoryEntryDto
import mx.violetcode.mobile.core.domain.model.DirectoryEntry
import mx.violetcode.mobile.core.domain.model.EntryKind
import mx.violetcode.mobile.core.domain.model.GeoPoint

internal fun DirectoryEntryDto.toEntity() = DirectoryEntryEntity(
    id = id, kind = kind, name = name, description = description, phone = phone,
    address = address, schedule = schedule, latitude = latitude, longitude = longitude,
    isEmergency = isEmergency,
)

/** null si el servidor envía un tipo que esta versión de la app no conoce (se ignora, no truena). */
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
