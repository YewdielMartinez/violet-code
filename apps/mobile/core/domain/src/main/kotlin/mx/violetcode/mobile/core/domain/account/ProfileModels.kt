package mx.violetcode.mobile.core.domain.account

/**
 * Datos de la usuaria que ella misma capturó al registrarse (RPC `get_mi_pre_registro`).
 * Por diseño NO incluye nada del expediente ni si la CURP está ligada a uno (RF-33.1).
 */
data class UserProfile(
    val nombres: String,
    val apellidoPaterno: String,
    val apellidoMaterno: String?,
    val email: String?,
    val curp: String,
    val celular: String?,
) {
    /** Nombre completo para «Mi perfil». */
    val fullName: String
        get() = listOf(nombres, apellidoPaterno, apellidoMaterno.orEmpty())
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .joinToString(" ")

    /** Solo el primer nombre: lo único que se muestra en el saludo de Inicio (discreción). */
    val firstName: String
        get() = nombres.trim().substringBefore(' ').trim()

    /** Iniciales (primer nombre + apellido paterno) para el avatar. */
    val initials: String
        get() = ProfileMasking.initials(nombres, apellidoPaterno)

    val maskedCurp: String get() = ProfileMasking.maskCurp(curp)
    val maskedCelular: String? get() = celular?.takeIf { it.isNotBlank() }?.let(ProfileMasking::maskCelular)
}

/** Estado del perfil que ve la UI. `Unavailable` no distingue «sin perfil» de «error»: no revela nada del caso. */
sealed interface ProfileState {
    data object SignedOut : ProfileState
    data object Loading : ProfileState
    data class Ready(val profile: UserProfile) : ProfileState
    data object Unavailable : ProfileState
}

/** Enmascarado de datos sensibles para mostrarlos en pantalla. */
object ProfileMasking {
    private const val STARS = "******"

    /** CURP: primeros 4 + `******` + últimos 2. Si es demasiado corta, se oculta toda. */
    fun maskCurp(curp: String): String {
        val c = curp.trim()
        return if (c.length < 7) STARS else c.take(4) + STARS + c.takeLast(2)
    }

    /** Celular: `******` + últimos 4 dígitos. Si es demasiado corto, se oculta todo. */
    fun maskCelular(celular: String): String {
        val c = celular.trim()
        return if (c.length < 5) STARS else STARS + c.takeLast(4)
    }

    fun initials(nombres: String, apellidoPaterno: String): String {
        val first = nombres.trim().firstOrNull { it.isLetter() }
        val second = apellidoPaterno.trim().firstOrNull { it.isLetter() }
        val text = listOfNotNull(first, second).joinToString("").uppercase()
        return text.ifEmpty { "?" }
    }
}
