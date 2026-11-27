package mx.violetcode.mobile.core.data.di

import androidx.room.Room
import io.github.jan.supabase.SupabaseClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import mx.violetcode.mobile.core.data.local.VioletDatabase
import mx.violetcode.mobile.core.data.repository.AccountRepositoryImpl
import mx.violetcode.mobile.core.data.repository.AlertRepositoryImpl
import mx.violetcode.mobile.core.data.repository.DirectoryRepositoryImpl
import mx.violetcode.mobile.core.data.supabase.createVioletSupabaseClient
import mx.violetcode.mobile.core.data.supabase.fetchDirectory
import mx.violetcode.mobile.core.domain.account.AccountRepository
import mx.violetcode.mobile.core.domain.account.AlertRepository
import mx.violetcode.mobile.core.domain.repository.DirectoryRepository
import org.koin.android.ext.koin.androidContext
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Único punto donde se conectan las implementaciones con las interfaces del dominio.
 * La app solo ve las interfaces del dominio; Supabase (auth + PostgREST), Room y los DTO son `internal`.
 */
fun dataModule(supabaseUrl: String, supabaseAnonKey: String): Module = module {
    // Supabase (auth + postgrest): sesión cifrada con Android Keystore. Solo URL pública + clave publishable.
    single { createVioletSupabaseClient(androidContext(), supabaseUrl, supabaseAnonKey) }

    // La copia local solo guarda información pública (directorio): si cambia el esquema, se descarta y se vuelve a bajar.
    single {
        Room.databaseBuilder(androidContext(), VioletDatabase::class.java, VioletDatabase.NAME)
            .fallbackToDestructiveMigration(dropAllTables = true)
            .build()
    }
    single { get<VioletDatabase>().directoryDao() }

    single<DirectoryRepository> {
        val client = get<SupabaseClient>()
        DirectoryRepositoryImpl(fetch = { client.fetchDirectory() }, dao = get(), io = Dispatchers.IO)
    }

    single<AccountRepository> {
        AccountRepositoryImpl(client = get(), scope = CoroutineScope(SupervisorJob() + Dispatchers.Default))
    }
    single<AlertRepository> { AlertRepositoryImpl(client = get()) }
}
