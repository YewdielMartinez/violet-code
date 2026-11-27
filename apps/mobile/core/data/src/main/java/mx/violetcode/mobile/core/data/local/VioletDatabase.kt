package mx.violetcode.mobile.core.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

/**
 * Base local. Hoy solo guarda información pública (directorio).
 * Si se guardan datos de la usuaria (solicitudes, caso), cifrar la base (p. ej. SQLCipher) antes.
 */
@Database(entities = [DirectoryEntryEntity::class], version = 2, exportSchema = false)
internal abstract class VioletDatabase : RoomDatabase() {
    abstract fun directoryDao(): DirectoryDao

    companion object {
        const val NAME = "violet.db"
    }
}
