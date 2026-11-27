package mx.violetcode.mobile.core.data.di

import androidx.room.Room
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.Json
import mx.violetcode.mobile.core.data.local.VioletDatabase
import mx.violetcode.mobile.core.data.remote.DirectoryApi
import mx.violetcode.mobile.core.data.repository.AccountRepositoryImpl
import mx.violetcode.mobile.core.data.repository.AlertRepositoryImpl
import mx.violetcode.mobile.core.data.repository.DirectoryRepositoryImpl
import mx.violetcode.mobile.core.data.supabase.createVioletSupabaseClient
import mx.violetcode.mobile.core.domain.account.AccountRepository
import mx.violetcode.mobile.core.domain.account.AlertRepository
import mx.violetcode.mobile.core.domain.repository.DirectoryRepository
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import org.koin.android.ext.koin.androidContext
import org.koin.core.module.Module
import org.koin.dsl.module
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Único punto donde se conectan las implementaciones con las interfaces del dominio.
 * La app solo ve `DirectoryRepository`; Retrofit (PostgREST Supabase), Room y los DTO son `internal`.
 */
fun dataModule(supabaseUrl: String, supabaseAnonKey: String): Module = module {
    val normalizedBaseUrl = if (supabaseUrl.endsWith("/")) supabaseUrl else "$supabaseUrl/"

    single {
        OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .addInterceptor { chain ->
                val original = chain.request()
                val req = original.newBuilder().header("Accept", "application/json")
                if (supabaseAnonKey.isNotBlank()) {
                    req.header("apikey", supabaseAnonKey)
                    if (original.header("Authorization") == null) {
                        req.header("Authorization", "Bearer $supabaseAnonKey")
                    }
                }
                chain.proceed(req.build())
            }
            // Sin interceptor de logging de cuerpos: no escribir datos de la usuaria en logcat.
            .build()
    }
    single {
        Retrofit.Builder()
            .baseUrl(normalizedBaseUrl)
            .client(get())
            .addConverterFactory(Json { ignoreUnknownKeys = true }.asConverterFactory("application/json".toMediaType()))
            .build()
    }
    single { get<Retrofit>().create(DirectoryApi::class.java) }

    single { Room.databaseBuilder(androidContext(), VioletDatabase::class.java, VioletDatabase.NAME).build() }
    single { get<VioletDatabase>().directoryDao() }

    single<DirectoryRepository> { DirectoryRepositoryImpl(api = get(), dao = get(), io = Dispatchers.IO) }

    // Supabase (auth + postgrest): sesión cifrada con Android Keystore. Solo URL pública + clave publishable.
    single { createVioletSupabaseClient(androidContext(), supabaseUrl, supabaseAnonKey) }
    single<AccountRepository> {
        AccountRepositoryImpl(client = get(), scope = CoroutineScope(SupervisorJob() + Dispatchers.Default))
    }
    single<AlertRepository> { AlertRepositoryImpl(client = get()) }
}
