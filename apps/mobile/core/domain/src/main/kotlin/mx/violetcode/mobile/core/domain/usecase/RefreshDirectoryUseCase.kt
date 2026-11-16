package mx.violetcode.mobile.core.domain.usecase

import mx.violetcode.mobile.core.domain.Outcome
import mx.violetcode.mobile.core.domain.repository.DirectoryRepository

/** Actualiza el directorio guardado desde el servidor. Si falla, lo guardado sigue disponible. */
class RefreshDirectoryUseCase(private val repository: DirectoryRepository) {
    suspend operator fun invoke(): Outcome<Unit> = repository.refresh()
}
