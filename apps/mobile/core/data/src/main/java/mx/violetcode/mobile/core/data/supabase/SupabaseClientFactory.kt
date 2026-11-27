package mx.violetcode.mobile.core.data.supabase

import android.content.Context
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest

/**
 * Cliente de Supabase de la app (RF-33, RNF-03/04/06).
 *
 * Solo recibe la URL pública y la clave publishable/anon (BuildConfig, leídas de local.properties).
 * Nunca se usa `service_role`: toda autorización la imponen las políticas RLS y los RPC del servidor.
 */
internal fun createVioletSupabaseClient(context: Context, url: String, publishableKey: String): SupabaseClient =
    createSupabaseClient(supabaseUrl = url.trim().trimEnd('/'), supabaseKey = publishableKey.trim()) {
        install(Auth) {
            sessionManager = KeystoreSessionManager(context)
            alwaysAutoRefresh = true
            autoLoadFromStorage = true
        }
        install(Postgrest)
    }
