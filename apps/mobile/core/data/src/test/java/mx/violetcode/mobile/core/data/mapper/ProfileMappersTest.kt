package mx.violetcode.mobile.core.data.mapper

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ProfileMappersTest {
    @Test
    fun `mapea el pre-registro y limpia espacios`() {
        val profile = MiPreRegistroDto(
            curp = " ROMA900101MDFDRN09 ", nombres = " Ana ", apellidoPaterno = "Romero",
            apellidoMaterno = "  ", celular = "6681234567",
        ).toDomain(email = " ana@example.com ")

        assertEquals("Ana", profile.nombres)
        assertEquals("ROMA900101MDFDRN09", profile.curp)
        assertNull(profile.apellidoMaterno)
        assertEquals("ana@example.com", profile.email)
        assertEquals("6681234567", profile.celular)
    }

    @Test
    fun `sin celular ni correo quedan nulos`() {
        val profile = MiPreRegistroDto(curp = "X", nombres = "Ana", apellidoPaterno = "R", celular = "").toDomain(email = null)
        assertNull(profile.celular)
        assertNull(profile.email)
    }
}
