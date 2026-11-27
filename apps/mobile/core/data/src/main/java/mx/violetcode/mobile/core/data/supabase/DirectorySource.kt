package mx.violetcode.mobile.core.data.supabase

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import mx.violetcode.mobile.core.data.remote.SupabaseDirectoryDto

/**
 * Lee `directorio_institucion` con el cliente de Supabase (usa el JWT de la sesión si existe).
 * RLS: la política de SELECT es `to authenticated using (activo or es_empleado_activo())`, así que sin
 * sesión el servidor responde 401/403 y la app se queda con lo guardado + los números de respaldo.
 * Solo se piden columnas públicas; el domicilio se pide siempre pero la BD lo prohíbe en refugios
 * y el mapper lo descarta de nuevo (defensa en profundidad).
 */
internal suspend fun SupabaseClient.fetchDirectory(): List<SupabaseDirectoryDto> =
    postgrest.from("directorio_institucion")
        .select(
            Columns.list(
                "id", "nombre", "categoria", "telefono", "horario", "es_24_horas",
                "calle", "numero_exterior", "codigo_postal", "orden",
            ),
        ) {
            filter { eq("activo", true) }
            order("orden", Order.ASCENDING)
            order("nombre", Order.ASCENDING)
        }
        .decodeList<SupabaseDirectoryDto>()
