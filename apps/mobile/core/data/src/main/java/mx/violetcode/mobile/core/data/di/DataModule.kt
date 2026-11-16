package mx.violetcode.mobile.core.data.di

import androidx.room.Room
import kotlinx.coroutines.Dispatchers
import kotlinx.serialization.json.Json
import mx.violetcode.mobile.core.data.local.VioletDatabase
import mx.violetcode.mobile.core.data.remote.DirectoryApi
import mx.violetcode.mobile.core.data.repository.DirectoryRepositoryImpl
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
 * La app solo ve `DirectoryRepository`; Retrofit, Room y los DTO son `internal` a este módulo.
 */
fun dataModule(baseUrl: String): Module = module {
    single {
        OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            // Sin interceptor de logging de cuerpos: no escribir datos de la usuaria en logcat.
            .build()
    }
    single {
        Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(get())
            .addConverterFactory(Json { ignoreUnknownKeys = true }.asConverterFactory("application/json".toMediaType()))
            .build()
    }
    single { get<Retrofit>().create(DirectoryApi::class.java) }

    single { Room.databaseBuilder(androidContext(), VioletDatabase::class.java, VioletDatabase.NAME).build() }
    single { get<VioletDatabase>().directoryDao() }

    single<DirectoryRepository> { DirectoryRepositoryImpl(api = get(), dao = get(), io = Dispatchers.IO) }
}
