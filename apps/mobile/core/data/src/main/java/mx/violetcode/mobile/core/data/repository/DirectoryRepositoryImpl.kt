package mx.violetcode.mobile.core.data.repository

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerializationException
import mx.violetcode.mobile.core.data.local.DirectoryDao
import mx.violetcode.mobile.core.data.mapper.toDomainOrNull
import mx.violetcode.mobile.core.data.mapper.toEntity
import mx.violetcode.mobile.core.data.remote.DirectoryApi
import mx.violetcode.mobile.core.domain.AppError
import mx.violetcode.mobile.core.domain.Outcome
import mx.violetcode.mobile.core.domain.model.DirectoryEntry
import mx.violetcode.mobile.core.domain.repository.DirectoryRepository
import retrofit2.HttpException
import java.io.IOException

/** Offline-first: la UI siempre lee de Room; la red solo actualiza Room. */
internal class DirectoryRepositoryImpl(
    private val api: DirectoryApi,
    private val dao: DirectoryDao,
    private val io: CoroutineDispatcher,
) : DirectoryRepository {

    override fun observeEntries(): Flow<List<DirectoryEntry>> =
        dao.observeAll().map { rows -> rows.mapNotNull { it.toDomainOrNull() } }

    override suspend fun refresh(): Outcome<Unit> = withContext(io) {
        // Solo se atrapan errores esperados: CancellationException sigue propagándose.
        try {
            dao.replaceAll(api.list().map { it.toEntity() })
            Outcome.Success(Unit)
        } catch (e: IOException) {
            Outcome.Failure(AppError.Network)
        } catch (e: HttpException) {
            Outcome.Failure(if (e.code() == 401) AppError.Unauthorized else AppError.Server(e.code()))
        } catch (e: SerializationException) {
            Outcome.Failure(AppError.Unexpected)
        }
    }
}
