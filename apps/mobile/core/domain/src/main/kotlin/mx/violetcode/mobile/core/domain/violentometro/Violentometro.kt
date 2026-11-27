package mx.violetcode.mobile.core.domain.violentometro

/**
 * Violentómetro (RF-26 / RF-26.1): escala orientativa de 0 a 30 con tres zonas.
 *
 * Es contenido estático y de solo orientación: este módulo NO guarda ni envía lo que la usuaria marque.
 * Guardar respuestas o puntaje exige consentimiento explícito (RF-26.1) y hoy no existe ese flujo.
 */
enum class ViolentometroZone(
    val headline: String,
    val advice: String,
    val levels: IntRange,
) {
    /** Amarillo → naranja → rojo. */
    Care(
        headline = "¡Ten cuidado! La violencia aumentará",
        advice = "Estas conductas ya son violencia aunque no dejen marcas. Si se repiten, suelen ir en aumento.",
        levels = 0..10,
    ),

    /** Magenta → morado. */
    React(
        headline = "¡Reacciona! No te dejes destruir",
        advice = "Tu integridad está en riesgo. Habla con alguien de confianza y busca orientación y acompañamiento.",
        levels = 11..20,
    ),

    /** Índigo → negro. */
    Help(
        headline = "¡Necesitas ayuda profesional!",
        advice = "Tu vida o tu seguridad pueden estar en peligro. Busca ayuda ahora: pide auxilio o llama a una línea de apoyo.",
        levels = 21..30,
    ),
    ;

    /** En las zonas altas se ofrece acceso directo al Botón de Ayuda y a la línea de apoyo. */
    val isHighRisk: Boolean get() = this != Care
}

/**
 * Una conducta de la escala. Ocupa de [from] a [to] (inclusive) porque la imagen oficial agrupa
 * algunos niveles (p. ej. 21–22 «Amenazar de muerte»).
 */
data class ViolentometroItem(
    val from: Int,
    val to: Int = from,
    val label: String,
    val details: String? = null,
) {
    init {
        require(from in Violentometro.MIN_LEVEL..Violentometro.MAX_LEVEL && to in from..Violentometro.MAX_LEVEL)
    }

    val zone: ViolentometroZone get() = Violentometro.zoneFor(from)

    /** Nivel que representa al marcarla en la escala: el más alto de su rango. */
    val level: Int get() = to

    /** «3» o «21–22». */
    val levelText: String get() = if (from == to) "$from" else "$from–$to"
}

object Violentometro {
    const val MIN_LEVEL = 0
    const val MAX_LEVEL = 30

    const val TITLE = "VIOLENTÓMETRO"
    const val TAGLINE = "Sí, la violencia también se mide"

    /**
     * Conductas tal como aparecen en la imagen oficial. La imagen omite los niveles 25 y 26:
     * se conservan así; [itemAt] resuelve esos dos niveles con «Forzar una relación sexual».
     */
    val items: List<ViolentometroItem> = listOf(
        // ¡Ten cuidado! La violencia aumentará
        ViolentometroItem(0, label = "Bromas hirientes"),
        ViolentometroItem(1, label = "Chantajear"),
        ViolentometroItem(2, label = "Mentir, engañar"),
        ViolentometroItem(3, label = "Ignorar, ley del hielo"),
        ViolentometroItem(4, label = "Celar"),
        ViolentometroItem(5, label = "Culpabilizar"),
        ViolentometroItem(6, label = "Descalificar"),
        ViolentometroItem(7, label = "Ridiculizar, ofender"),
        ViolentometroItem(8, label = "Humillar en público"),
        ViolentometroItem(9, label = "Intimidar, amenazar"),
        ViolentometroItem(
            10,
            label = "Controlar, prohibir",
            details = "Amistades, familiares, dinero, lugares, apariencias, actividades, celular, mails, redes sociales",
        ),
        // ¡Reacciona! No te dejes destruir
        ViolentometroItem(11, label = "Destruir artículos personales"),
        ViolentometroItem(12, label = "Manosear"),
        ViolentometroItem(13, label = "Caricias agresivas"),
        ViolentometroItem(14, label = "Golpear «jugando»"),
        ViolentometroItem(15, label = "Pellizcar, arañar"),
        ViolentometroItem(16, label = "Empujar, jalonear"),
        ViolentometroItem(17, label = "Cachetear"),
        ViolentometroItem(18, label = "Patear"),
        ViolentometroItem(19, label = "Encerrar, aislar"),
        ViolentometroItem(20, label = "Amenazar con objetos o armas"),
        // ¡Necesitas ayuda profesional!
        ViolentometroItem(21, 22, label = "Amenazar de muerte"),
        ViolentometroItem(23, 24, label = "Forzar una relación sexual"),
        ViolentometroItem(27, label = "Abuso sexual"),
        ViolentometroItem(28, label = "Violar"),
        ViolentometroItem(29, label = "Mutilar"),
        ViolentometroItem(30, label = "Asesinar"),
    )

    fun zoneFor(level: Int): ViolentometroZone {
        val clamped = level.coerceIn(MIN_LEVEL, MAX_LEVEL)
        return ViolentometroZone.entries.first { clamped in it.levels }
    }

    fun itemsIn(zone: ViolentometroZone): List<ViolentometroItem> = items.filter { it.zone == zone }

    /** Conducta que corresponde a [level]; los niveles sin renglón (25–26) toman la conducta anterior. */
    fun itemAt(level: Int): ViolentometroItem {
        val clamped = level.coerceIn(MIN_LEVEL, MAX_LEVEL)
        return items.firstOrNull { clamped in it.from..it.to }
            ?: items.last { it.from <= clamped }
    }

    /** Nivel más alto entre las conductas marcadas; `null` si no hay ninguna. */
    fun peakLevel(selected: Collection<ViolentometroItem>): Int? = selected.maxOfOrNull { it.level }
}
