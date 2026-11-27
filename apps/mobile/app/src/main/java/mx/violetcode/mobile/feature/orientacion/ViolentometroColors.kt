package mx.violetcode.mobile.feature.orientacion

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.luminance
import mx.violetcode.mobile.core.domain.violentometro.Violentometro
import mx.violetcode.mobile.core.domain.violentometro.ViolentometroZone

// Colores de la escala oficial. Cada zona es un degradado entre sus paradas.
private val Yellow = Color(0xFFFFD400)
private val Orange = Color(0xFFFF8A00)
private val Red = Color(0xFFE02020)
private val Magenta = Color(0xFFE0208C)
private val Purple = Color(0xFF7A1FB0)
private val Indigo = Color(0xFF3A3FB5)
private val Black = Color(0xFF0A0A0A)

private data class Stop(val level: Int, val color: Color)

private val stops = listOf(
    Stop(0, Yellow), Stop(5, Orange), Stop(10, Red),
    Stop(11, Magenta), Stop(20, Purple),
    Stop(21, Indigo), Stop(30, Black),
)

/** Color de un nivel 0–30: degradado dentro de su zona, corte seco entre zonas. */
internal fun violentometroLevelColor(level: Int): Color {
    val l = level.coerceIn(Violentometro.MIN_LEVEL, Violentometro.MAX_LEVEL)
    val zone = Violentometro.zoneFor(l)
    val zoneStops = stops.filter { it.level in zone.levels }
    val upper = zoneStops.firstOrNull { it.level >= l } ?: zoneStops.last()
    val lower = zoneStops.lastOrNull { it.level <= l } ?: zoneStops.first()
    if (upper.level == lower.level) return lower.color
    return lerp(lower.color, upper.color, (l - lower.level).toFloat() / (upper.level - lower.level))
}

/** Degradado horizontal de toda la escala (con corte seco entre zonas). */
internal fun violentometroBrush(): Brush {
    val max = Violentometro.MAX_LEVEL.toFloat()
    return Brush.horizontalGradient(
        colorStops = stops.map { (it.level / max) to it.color }.toTypedArray(),
    )
}

internal fun violentometroZoneBrush(zone: ViolentometroZone): Brush = Brush.horizontalGradient(
    colors = stops.filter { it.level in zone.levels }.map { it.color },
)

/** Color de zona sólido para acentos (parada intermedia más representativa). */
internal fun violentometroZoneAccent(zone: ViolentometroZone): Color = when (zone) {
    ViolentometroZone.Care -> Orange
    ViolentometroZone.React -> Magenta
    ViolentometroZone.Help -> Indigo
}

private val NearBlack = Color(0xFF000000)
private val White = Color(0xFFFFFFFF)

internal fun contrastRatio(a: Color, b: Color): Float {
    val la = a.luminance() + 0.05f
    val lb = b.luminance() + 0.05f
    return if (la > lb) la / lb else lb / la
}

/**
 * Texto (blanco o negro) con el mayor contraste sobre [background]. Con solo esas dos opciones el peor caso
 * es ≈4.58:1, así que siempre cumple WCAG AA (4.5:1) para texto normal sin importar la banda del degradado.
 */
internal fun violentometroOnColor(background: Color): Color =
    if (contrastRatio(White, background) >= contrastRatio(NearBlack, background)) White else NearBlack
