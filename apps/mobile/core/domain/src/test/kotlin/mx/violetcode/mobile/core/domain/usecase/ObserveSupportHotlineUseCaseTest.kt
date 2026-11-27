package mx.violetcode.mobile.core.domain.usecase

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import mx.violetcode.mobile.core.domain.Outcome
import mx.violetcode.mobile.core.domain.model.DirectoryEntry
import mx.violetcode.mobile.core.domain.model.EmergencyFallback
import mx.violetcode.mobile.core.domain.model.EntryKind
import mx.violetcode.mobile.core.domain.repository.DirectoryRepository
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

class ObserveSupportHotlineUseCaseTest {
    private fun entry(name: String, phone: String?, category: String?, emergency: Boolean = false) = DirectoryEntry(
        id = name, kind = EntryKind.Institution, name = name, description = null, phone = phone, address = null,
        schedule = null, location = null, isEmergency = emergency, category = category,
    )

    private class Fake(private val entries: List<DirectoryEntry>) : DirectoryRepository {
        override fun observeEntries(): Flow<List<DirectoryEntry>> = flowOf(entries)
        override suspend fun refresh(): Outcome<Unit> = Outcome.Success(Unit)
    }

    @Test
    fun `prefiere la linea de apoyo sobre la emergencia`() = runTest {
        val result = ObserveSupportHotlineUseCase(
            Fake(listOf(entry("911", "911", "emergencia", true), entry("Línea", "089", DirectoryEntry.CATEGORY_SUPPORT_LINE))),
        )().first()
        assertEquals("Línea", result?.name)
    }

    @Test
    fun `sin linea de apoyo usa la primera emergencia`() = runTest {
        val result = ObserveSupportHotlineUseCase(Fake(listOf(entry("Salud", "1", "salud"), entry("911", "911", "emergencia", true))))().first()
        assertEquals("911", result?.name)
    }

    @Test
    fun `ignora entradas sin telefono y sin candidatas devuelve null`() = runTest {
        val result = ObserveSupportHotlineUseCase(Fake(listOf(entry("Sin tel", null, DirectoryEntry.CATEGORY_SUPPORT_LINE))))().first()
        assertNull(result)
    }

    @Test
    fun `los numeros de respaldo incluyen 911 y una linea de apoyo y nunca domicilio`() {
        assertEquals(listOf("911", "089"), EmergencyFallback.entries.map { it.phone })
        assertFalse(EmergencyFallback.entries.any { it.address != null })
    }
}
