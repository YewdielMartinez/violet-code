package mx.violetcode.mobile.feature.orientacion

import androidx.compose.ui.graphics.Color
import mx.violetcode.mobile.core.domain.violentometro.Violentometro
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ViolentometroColorsTest {

    @Test
    fun `el texto de cada nivel cumple contraste AA de 4,5 a 1`() {
        (Violentometro.MIN_LEVEL..Violentometro.MAX_LEVEL).forEach { level ->
            val background = violentometroLevelColor(level)
            val ratio = contrastRatio(violentometroOnColor(background), background)
            assertTrue("nivel $level: contraste $ratio", ratio >= 4.5f)
        }
    }

    @Test
    fun `fondos claros llevan texto negro y fondos oscuros texto blanco`() {
        assertEquals(Color(0xFF000000), violentometroOnColor(Color(0xFFFFD400)))
        assertEquals(Color(0xFFFFFFFF), violentometroOnColor(Color(0xFF0A0A0A)))
    }

    @Test
    fun `los extremos de la escala son amarillo y negro y hay corte seco entre zonas`() {
        assertEquals(Color(0xFFFFD400), violentometroLevelColor(0))
        assertEquals(Color(0xFF0A0A0A), violentometroLevelColor(30))
        assertEquals(Color(0xFFE02020), violentometroLevelColor(10))
        assertEquals(Color(0xFFE0208C), violentometroLevelColor(11))
        assertEquals(Color(0xFF3A3FB5), violentometroLevelColor(21))
    }
}
