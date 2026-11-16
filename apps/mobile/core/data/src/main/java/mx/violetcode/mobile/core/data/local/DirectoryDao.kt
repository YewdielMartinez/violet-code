package mx.violetcode.mobile.core.data.local

import androidx.room.Dao
import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

/** Copia local del directorio público (no contiene datos de la usuaria). */
@Entity(tableName = "directory_entries")
internal data class DirectoryEntryEntity(
    @PrimaryKey val id: String,
    val kind: String,
    val name: String,
    val description: String?,
    val phone: String?,
    val address: String?,
    val schedule: String?,
    val latitude: Double?,
    val longitude: Double?,
    val isEmergency: Boolean,
)

@Dao
internal interface DirectoryDao {
    @Query("SELECT * FROM directory_entries")
    fun observeAll(): Flow<List<DirectoryEntryEntity>>

    @Upsert
    suspend fun upsert(entries: List<DirectoryEntryEntity>)

    @Query("DELETE FROM directory_entries")
    suspend fun deleteAll()

    /** Reemplaza todo en una sola transacción: la UI nunca ve el directorio vacío a medias. */
    @Transaction
    suspend fun replaceAll(entries: List<DirectoryEntryEntity>) {
        deleteAll()
        upsert(entries)
    }
}
