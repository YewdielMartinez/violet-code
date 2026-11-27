package mx.violetcode.mobile.core.domain.usecase

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import mx.violetcode.mobile.core.domain.model.DirectoryEntry
import mx.violetcode.mobile.core.domain.repository.DirectoryRepository

/**
 * Línea de apoyo que se ofrece en un clic (p. ej. desde el Violentómetro en zonas altas):
 * la primera de categoría `linea_apoyo` del directorio con teléfono; si no hay, la primera de emergencia.
 */
class ObserveSupportHotlineUseCase(private val repository: DirectoryRepository) {
    operator fun invoke(): Flow<DirectoryEntry?> = repository.observeEntries().map(::pick)

    internal fun pick(entries: List<DirectoryEntry>): DirectoryEntry? {
        val withPhone = entries.filter { !it.phone.isNullOrBlank() }
        return withPhone.firstOrNull { it.category == DirectoryEntry.CATEGORY_SUPPORT_LINE }
            ?: withPhone.firstOrNull { it.isEmergency }
    }
}
