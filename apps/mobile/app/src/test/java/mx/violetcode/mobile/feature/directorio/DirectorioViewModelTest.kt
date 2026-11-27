package mx.violetcode.mobile.feature.directorio

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import mx.violetcode.mobile.core.domain.AppError
import mx.violetcode.mobile.core.domain.Outcome
import mx.violetcode.mobile.core.domain.model.DirectoryEntry
import mx.violetcode.mobile.core.domain.model.EntryKind
import mx.violetcode.mobile.core.domain.repository.DirectoryRepository
import mx.violetcode.mobile.core.domain.usecase.ObserveDirectoryUseCase
import mx.violetcode.mobile.core.domain.usecase.ObserveSessionUseCase
import mx.violetcode.mobile.core.domain.usecase.RefreshDirectoryUseCase
import mx.violetcode.mobile.core.domain.account.SessionState
import mx.violetcode.mobile.feature.perfil.FakeAccounts
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class DirectorioViewModelTest {

    private class FakeRepository(cached: List<DirectoryEntry>, private val refreshResult: Outcome<Unit>) : DirectoryRepository {
        var refreshes = 0
        private val store = MutableStateFlow(cached)
        override fun observeEntries(): Flow<List<DirectoryEntry>> = store
        override suspend fun refresh(): Outcome<Unit> { refreshes++; return refreshResult }
    }

    private val cachedEntry = DirectoryEntry(
        id = "1", kind = EntryKind.Institution, name = "Emergencias 911", description = null, phone = "911",
        address = null, schedule = null, location = null, isEmergency = true,
    )

    @Before fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())
    @After fun tearDown() = Dispatchers.resetMain()

    private fun viewModel(repo: DirectoryRepository, accounts: FakeAccounts = FakeAccounts(SessionState.SignedOut)) =
        DirectorioViewModel(ObserveDirectoryUseCase(repo), RefreshDirectoryUseCase(repo), ObserveSessionUseCase(accounts))

    @Test
    fun `sin conexion pero con datos guardados muestra el directorio y avisa`() = runTest {
        val vm = viewModel(FakeRepository(listOf(cachedEntry), Outcome.Failure(AppError.Network)))
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { vm.state.collect {} }

        val state = vm.state.value
        assertEquals(listOf(cachedEntry), state.entries)
        assertEquals(AppError.Network, state.lastError)
        assertFalse(state.showFullError)
    }

    @Test
    fun `sin conexion y sin datos guardados muestra error completo`() = runTest {
        val vm = viewModel(FakeRepository(emptyList(), Outcome.Failure(AppError.Network)))
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { vm.state.collect {} }

        assertTrue(vm.state.value.showFullError)
    }

    @Test
    fun `al iniciar sesion el directorio se actualiza solo`() = runTest {
        val repo = FakeRepository(emptyList(), Outcome.Success(Unit))
        val accounts = FakeAccounts(SessionState.SignedOut)
        val vm = viewModel(repo, accounts)
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { vm.state.collect {} }
        assertEquals(1, repo.refreshes) // el de arranque

        accounts.sessionFlow.value = SessionState.SignedIn("u")

        assertEquals(2, repo.refreshes)
    }

    @Test
    fun `si ya hay sesion al abrir solo se actualiza una vez y cerrar sesion no actualiza`() = runTest {
        val repo = FakeRepository(emptyList(), Outcome.Success(Unit))
        val accounts = FakeAccounts(SessionState.SignedIn("u"))
        viewModel(repo, accounts)
        assertEquals(1, repo.refreshes)

        accounts.sessionFlow.value = SessionState.SignedOut

        assertEquals(1, repo.refreshes)
    }
}
