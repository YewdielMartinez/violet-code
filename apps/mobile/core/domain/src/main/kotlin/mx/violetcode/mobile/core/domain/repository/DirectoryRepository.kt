package mx.violetcode.mobile.core.domain.repository

import kotlinx.coroutines.flow.Flow
import mx.violetcode.mobile.core.domain.Outcome
import mx.violetcode.mobile.core.domain.model.DirectoryEntry

/**
 * Directorio offline-first. Se define en el dominio y se implementa en core:data.
 * - observeEntries(): lo guardado en el teléfono (funciona sin conexión).
 * - refresh(): descarga del servidor y actualiza lo guardado.
 */
interface DirectoryRepository {
    fun observeEntries(): Flow<List<DirectoryEntry>>
    suspend fun refresh(): Outcome<Unit>
}
