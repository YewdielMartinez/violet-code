package mx.violetcode.mobile.core.domain.model

/**
 * Números nacionales que la app muestra aunque el directorio no se haya podido descargar
 * (sin sesión, sin conexión o primera vez). Son públicos y no cambian.
 */
object EmergencyFallback {
    val entries: List<DirectoryEntry> = listOf(
        DirectoryEntry(
            id = "fallback-911", kind = EntryKind.Institution, name = "Emergencias 911",
            description = "Emergencia", phone = "911", address = null, schedule = "24 horas",
            location = null, isEmergency = true, category = "emergencia",
        ),
        DirectoryEntry(
            id = "fallback-089", kind = EntryKind.Institution, name = "Denuncia Anónima 089",
            description = "Línea de apoyo", phone = "089", address = null, schedule = "24 horas",
            location = null, isEmergency = true, category = DirectoryEntry.CATEGORY_SUPPORT_LINE,
        ),
    )
}
