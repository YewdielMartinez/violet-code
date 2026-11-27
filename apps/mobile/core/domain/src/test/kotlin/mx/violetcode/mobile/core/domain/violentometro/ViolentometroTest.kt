package mx.violetcode.mobile.core.domain.violentometro

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ViolentometroTest {

    @Test
    fun `los niveles 0 a 10 son la zona de cuidado`() {
        (0..10).forEach { assertEquals("nivel $it", ViolentometroZone.Care, Violentometro.zoneFor(it)) }
    }

    @Test
    fun `los niveles 11 a 20 son la zona de reaccionar`() {
        (11..20).forEach { assertEquals("nivel $it", ViolentometroZone.React, Violentometro.zoneFor(it)) }
    }

    @Test
    fun `los niveles 21 a 30 son la zona de ayuda profesional`() {
        (21..30).forEach { assertEquals("nivel $it", ViolentometroZone.Help, Violentometro.zoneFor(it)) }
    }

    @Test
    fun `valores fuera de rango se ajustan a los extremos`() {
        assertEquals(ViolentometroZone.Care, Violentometro.zoneFor(-5))
        assertEquals(ViolentometroZone.Help, Violentometro.zoneFor(99))
    }

    @Test
    fun `las tres zonas cubren 0 a 30 sin huecos ni traslapes`() {
        val covered = ViolentometroZone.entries.flatMap { it.levels.toList() }
        assertEquals((0..30).toList(), covered)
    }

    @Test
    fun `titulares exactos de las zonas`() {
        assertEquals("¡Ten cuidado! La violencia aumentará", ViolentometroZone.Care.headline)
        assertEquals("¡Reacciona! No te dejes destruir", ViolentometroZone.React.headline)
        assertEquals("¡Necesitas ayuda profesional!", ViolentometroZone.Help.headline)
    }

    @Test
    fun `solo las zonas altas ofrecen acceso a ayuda`() {
        assertFalse(ViolentometroZone.Care.isHighRisk)
        assertTrue(ViolentometroZone.React.isHighRisk)
        assertTrue(ViolentometroZone.Help.isHighRisk)
    }

    @Test
    fun `las conductas son las de la imagen oficial`() {
        assertEquals(27, Violentometro.items.size)
        assertEquals(11, Violentometro.itemsIn(ViolentometroZone.Care).size)
        assertEquals(10, Violentometro.itemsIn(ViolentometroZone.React).size)
        assertEquals(6, Violentometro.itemsIn(ViolentometroZone.Help).size)
        assertEquals("Bromas hirientes", Violentometro.items.first().label)
        assertEquals("Asesinar", Violentometro.items.last().label)
        assertEquals("21–22", Violentometro.itemAt(21).levelText)
        assertEquals("23–24", Violentometro.itemAt(24).levelText)
    }

    @Test
    fun `cada conducta pertenece a una sola zona`() {
        Violentometro.items.forEach { assertEquals(Violentometro.zoneFor(it.from), Violentometro.zoneFor(it.to)) }
    }

    @Test
    fun `los niveles 25 y 26 no tienen renglon y toman forzar una relacion sexual`() {
        assertEquals("Forzar una relación sexual", Violentometro.itemAt(25).label)
        assertEquals("Forzar una relación sexual", Violentometro.itemAt(26).label)
        assertEquals("Abuso sexual", Violentometro.itemAt(27).label)
    }

    @Test
    fun `el nivel maximo marcado manda`() {
        val marcadas = listOf(Violentometro.itemAt(3), Violentometro.itemAt(17), Violentometro.itemAt(21))
        assertEquals(22, Violentometro.peakLevel(marcadas))
        assertEquals(ViolentometroZone.Help, Violentometro.zoneFor(Violentometro.peakLevel(marcadas)!!))
        assertNull(Violentometro.peakLevel(emptyList()))
    }
}

class ViolentometroSelectionTest {
    private val celar = Violentometro.itemAt(4)
    private val cachetear = Violentometro.itemAt(17)
    private val violar = Violentometro.itemAt(28)

    @Test
    fun `sin marcar no hay nivel ni zona`() {
        val s = ViolentometroSelection()
        assertNull(s.level)
        assertNull(s.zone)
    }

    @Test
    fun `la conducta marcada mas alta manda`() {
        val s = ViolentometroSelection().toggle(celar).toggle(cachetear)
        assertEquals(17, s.level)
        assertEquals(ViolentometroZone.React, s.zone)
        assertTrue(s.isSelected(celar))
    }

    @Test
    fun `desmarcar baja el nivel`() {
        val s = ViolentometroSelection().toggle(celar).toggle(violar).toggle(violar)
        assertEquals(4, s.level)
        assertEquals(ViolentometroZone.Care, s.zone)
    }

    @Test
    fun `mover el marcador a mano manda hasta marcar otra conducta`() {
        val s = ViolentometroSelection().toggle(celar).withManualLevel(25)
        assertEquals(25, s.level)
        assertEquals(ViolentometroZone.Help, s.zone)
        assertEquals(4, s.toggle(violar).toggle(violar).level)
    }

    @Test
    fun `el nivel manual se ajusta al rango`() {
        assertEquals(30, ViolentometroSelection().withManualLevel(99).level)
        assertEquals(0, ViolentometroSelection().withManualLevel(-3).level)
    }

    @Test
    fun `limpiar borra todo`() {
        val s = ViolentometroSelection().toggle(violar).withManualLevel(12).cleared()
        assertNull(s.level)
        assertTrue(s.selectedKeys.isEmpty())
    }
}
