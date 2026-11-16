package mx.violetcode.mobile.core.domain.usecase

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import mx.violetcode.mobile.core.domain.model.DirectoryEntry
import mx.violetcode.mobile.core.domain.model.EntryKind
import mx.violetcode.mobile.core.domain.repository.DirectoryRepository

/**
 * Directorio listo para mostrar.
 * Regla: los números de emergencia SIEMPRE van primero; después, orden alfabético.
 */
class ObserveDirectoryUseCase(private val repository: DirectoryRepository) {

    operator fun invoke(kind: EntryKind? = null): Flow<List<DirectoryEntry>> =
        repository.observeEntries().map { entries ->
            entries
                .filter { kind == null || it.kind == kind || it.isEmergency }
                .sortedWith(EMERGENCY_FIRST)
        }

    private companion object {
        val EMERGENCY_FIRST = compareByDescending<DirectoryEntry> { it.isEmergency }
            .thenBy(String.CASE_INSENSITIVE_ORDER) { it.name }
    }
}
