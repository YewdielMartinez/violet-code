package mx.violetcode.mobile

import android.app.Application
import mx.violetcode.mobile.core.data.di.dataModule
import mx.violetcode.mobile.di.appModule
import mx.violetcode.mobile.security.SecureWindowCallbacks
import org.koin.android.ext.koin.androidContext
import org.koin.core.context.startKoin

class VioletApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // FLAG_SECURE en todas las ventanas de la app (sin capturas ni vista previa en recientes).
        registerActivityLifecycleCallbacks(SecureWindowCallbacks())
        startKoin {
            androidContext(this@VioletApplication)
            modules(
                dataModule(
                    supabaseUrl = BuildConfig.SUPABASE_URL,
                    supabaseAnonKey = BuildConfig.SUPABASE_ANON_KEY,
                ),
                appModule,
            )
        }
    }
}
