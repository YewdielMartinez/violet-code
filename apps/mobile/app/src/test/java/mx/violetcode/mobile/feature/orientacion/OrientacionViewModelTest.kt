package mx.violetcode.mobile.feature.orientacion

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import mx.violetcode.mobile.core.domain.Outcome
import mx.violetcode.mobile.core.domain.model.EmergencyFallback
import mx.violetcode.mobile.core.domain.model.DirectoryEntry
import mx.violetcode.mobile.core.domain.repository.DirectoryRepository
import mx.violetcode.mobile.core.domain.usecase.ObserveSupportHotlineUseCase
import mx.violetcode.mobile.core.domain.violentometro.Violentometro
import mx.violetcode.mobile.core.domain.violentometro.ViolentometroZone
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class OrientacionViewModelTest {
    private class Repo(entries: List<DirectoryEntry>) : DirectoryRepository {
        private val store = MutableStateFlow(entries)
        override fun observeEntries(): Flow<List<DirectoryEntry>> = store
        override suspend fun refresh(): Outcome<Unit> = Outcome.Success(Unit)
    }

    @Before fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())
    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm() = OrientacionViewModel(ObserveSupportHotlineUseCase(Repo(EmergencyFallback.entries)))

    @Test
    fun `marcar conductas mueve la escala y limpiar la reinicia`() {
        val vm = vm()
        assertNull(vm.selection.value.level)

        vm.toggle(Violentometro.itemAt(17))
        assertEquals(17, vm.selection.value.level)
        assertEquals(ViolentometroZone.React, vm.selection.value.zone)

        vm.setLevel(25)
        assertEquals(ViolentometroZone.Help, vm.selection.value.zone)

        vm.clear()
        assertNull(vm.selection.value.level)
    }

    @Test
    fun `ofrece la linea de apoyo del directorio`() = runTest {
        val vm = vm()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { vm.hotline.collect {} }
        assertEquals("089", vm.hotline.value?.phone)
    }
}
