package mx.violetcode.mobile.core.domain.usecase

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import mx.violetcode.mobile.core.domain.Outcome
import mx.violetcode.mobile.core.domain.model.DirectoryEntry
import mx.violetcode.mobile.core.domain.model.EntryKind
import mx.violetcode.mobile.core.domain.repository.DirectoryRepository
import org.junit.Assert.assertEquals
import org.junit.Test

class ObserveDirectoryUseCaseTest {

    private fun entry(name: String, kind: EntryKind, emergency: Boolean = false) = DirectoryEntry(
        id = name, kind = kind, name = name, description = null, phone = null,
        address = null, schedule = null, location = null, isEmergency = emergency,
    )

    private class FakeRepository(private val entries: List<DirectoryEntry>) : DirectoryRepository {
        override fun observeEntries(): Flow<List<DirectoryEntry>> = flowOf(entries)
        override suspend fun refresh(): Outcome<Unit> = Outcome.Success(Unit)
    }

    private val data = listOf(
        entry("Salud", EntryKind.Institution),
        entry("biblioteca", EntryKind.VioletPoint),
        entry("Emergencias 911", EntryKind.Institution, emergency = true),
        entry("Asesoría", EntryKind.Institution),
    )

    @Test
    fun `emergencias primero y luego orden alfabetico sin importar mayusculas`() = runTest {
        val result = ObserveDirectoryUseCase(FakeRepository(data))().first()

        assertEquals(listOf("Emergencias 911", "Asesoría", "biblioteca", "Salud"), result.map { it.name })
    }

    @Test
    fun `al filtrar por tipo se conservan los numeros de emergencia`() = runTest {
        val result = ObserveDirectoryUseCase(FakeRepository(data))(EntryKind.VioletPoint).first()

        assertEquals(listOf("Emergencias 911", "biblioteca"), result.map { it.name })
    }
}
