package mx.violetcode.mobile.core.data.mapper

import mx.violetcode.mobile.core.data.remote.SupabaseDirectoryDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DirectoryMappersTest {

    private fun dto(
        categoria: String,
        horario: String? = null,
        es24: Boolean = false,
        calle: String? = null,
        numero: String? = null,
        cp: String? = null,
    ) = SupabaseDirectoryDto(
        id = 1, nombre = "X", categoria = categoria, telefono = "6688164000", horario = horario,
        es24Horas = es24, calle = calle, numeroExterior = numero, codigoPostal = cp,
    )

    @Test
    fun `una dependencia abierta muestra su domicilio publico`() {
        val entity = dto("orientacion_legal", "Lunes a Viernes 8:00-15:00", calle = "Calle Marcial Ordóñez", numero = "120").toEntity()
        assertEquals("Calle Marcial Ordóñez, 120", entity.address)
        assertEquals("Lunes a Viernes 8:00-15:00", entity.schedule)
    }

    @Test
    fun `un refugio nunca tiene domicilio aunque llegue en los datos`() {
        val entity = dto("refugio", es24 = true, calle = "Secreta", numero = "1", cp = "81200").toEntity()
        assertNull(entity.address)
        assertNull(entity.toDomainOrNull()!!.address)
    }

    @Test
    fun `una fila local antigua de refugio tampoco muestra domicilio`() {
        val stale = dto("refugio", calle = "Secreta").toEntity().copy(address = "Secreta 1")
        assertNull(stale.toDomainOrNull()!!.address)
    }

    @Test
    fun `sin horario pero 24 horas se muestra 24 horas`() {
        assertEquals("24 horas", dto("emergencia", es24 = true).toEntity().schedule)
        assertNull(dto("salud").toEntity().schedule)
    }

    @Test
    fun `conserva la categoria y marca emergencias`() {
        val entity = dto("linea_apoyo", es24 = true).toEntity()
        assertEquals("linea_apoyo", entity.toDomainOrNull()!!.category)
        assertEquals(true, entity.isEmergency)
        assertEquals("Línea de apoyo", entity.description)
    }
}
