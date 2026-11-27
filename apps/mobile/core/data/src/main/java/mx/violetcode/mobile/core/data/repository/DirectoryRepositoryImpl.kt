package mx.violetcode.mobile.core.data.repository

import io.github.jan.supabase.exceptions.HttpRequestException
import io.github.jan.supabase.exceptions.RestException
import io.ktor.client.plugins.HttpRequestTimeoutException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerializationException
import mx.violetcode.mobile.core.data.local.DirectoryDao
import mx.violetcode.mobile.core.data.mapper.toDomainOrNull
import mx.violetcode.mobile.core.data.mapper.toEntity
import mx.violetcode.mobile.core.data.remote.SupabaseDirectoryDto
import mx.violetcode.mobile.core.domain.AppError
import mx.violetcode.mobile.core.domain.Outcome
import mx.violetcode.mobile.core.domain.model.DirectoryEntry
import mx.violetcode.mobile.core.domain.model.EmergencyFallback
import mx.violetcode.mobile.core.domain.repository.DirectoryRepository
import java.io.IOException

/**
 * Offline-first: la UI siempre lee de Room; la red solo actualiza Room.
 * Si no hay nada guardado (primera vez, sin sesión o sin red) se muestran los números nacionales de
 * [EmergencyFallback]: el 911 nunca debe faltar.
 */
internal class DirectoryRepositoryImpl(
    private val fetch: suspend () -> List<SupabaseDirectoryDto>,
    private val dao: DirectoryDao,
    private val io: CoroutineDispatcher,
) : DirectoryRepository {

    override fun observeEntries(): Flow<List<DirectoryEntry>> =
        dao.observeAll().map { rows ->
            rows.mapNotNull { it.toDomainOrNull() }.ifEmpty { EmergencyFallback.entries }
        }

    override suspend fun refresh(): Outcome<Unit> = withContext(io) {
        // Solo se atrapan errores esperados: CancellationException sigue propagándose.
        try {
            dao.replaceAll(fetch().map { it.toEntity() })
            Outcome.Success(Unit)
        } catch (e: RestException) {
            Outcome.Failure(if (e.statusCode == 401 || e.statusCode == 403) AppError.Unauthorized else AppError.Server(e.statusCode))
        } catch (e: HttpRequestTimeoutException) {
            Outcome.Failure(AppError.Network)
        } catch (e: HttpRequestException) {
            Outcome.Failure(AppError.Network)
        } catch (e: IOException) {
            Outcome.Failure(AppError.Network)
        } catch (e: SerializationException) {
            Outcome.Failure(AppError.Unexpected)
        }
    }
}
