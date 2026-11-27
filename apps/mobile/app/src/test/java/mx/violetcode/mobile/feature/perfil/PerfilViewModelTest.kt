package mx.violetcode.mobile.feature.perfil

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import mx.violetcode.mobile.core.domain.account.AccountFailure
import mx.violetcode.mobile.core.domain.account.AccountRepository
import mx.violetcode.mobile.core.domain.account.AccountResult
import mx.violetcode.mobile.core.domain.account.ProfileState
import mx.violetcode.mobile.core.domain.account.RegistrationData
import mx.violetcode.mobile.core.domain.account.SessionState
import mx.violetcode.mobile.core.domain.account.SignUpOutcome
import mx.violetcode.mobile.core.domain.account.UserProfile
import mx.violetcode.mobile.core.domain.usecase.ObserveMyProfileUseCase
import mx.violetcode.mobile.core.domain.usecase.SignOutUseCase
import mx.violetcode.mobile.feature.inicio.InicioViewModel
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

internal val testProfile = UserProfile(
    nombres = "Ana María", apellidoPaterno = "Romero", apellidoMaterno = "Díaz",
    email = "ana@example.com", curp = "ROMA900101MDFDRN09", celular = "6681234567",
)

internal class FakeAccounts(
    initial: SessionState,
    var profileResult: AccountResult<UserProfile?> = AccountResult.Success(testProfile),
) : AccountRepository {
    val sessionFlow = MutableStateFlow(initial)
    var signOuts = 0
    override val session: StateFlow<SessionState> = sessionFlow
    override suspend fun signUp(data: RegistrationData) = AccountResult.Success(SignUpOutcome.CheckEmail)
    override suspend fun signIn(email: String, password: String) = AccountResult.Success(Unit)
    override suspend fun signOut() {
        signOuts++
        sessionFlow.value = SessionState.SignedOut
    }
    override suspend fun ensureProfile(): AccountResult<Boolean> = AccountResult.Success(true)
    override suspend fun getMyProfile(): AccountResult<UserProfile?> = profileResult
}

@OptIn(ExperimentalCoroutinesApi::class)
class PerfilViewModelTest {
    @Before fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())
    @After fun tearDown() = Dispatchers.resetMain()

    private fun viewModel(accounts: FakeAccounts) =
        PerfilViewModel(ObserveMyProfileUseCase(accounts), SignOutUseCase(accounts))

    @Test
    fun `con sesion muestra el perfil`() = runTest {
        val vm = viewModel(FakeAccounts(SessionState.SignedIn("u")))
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { vm.state.collect {} }
        assertEquals(ProfileState.Ready(testProfile), vm.state.value.profile)
    }

    @Test
    fun `cerrar sesion llama al caso de uso y el perfil pasa a SignedOut`() = runTest {
        val accounts = FakeAccounts(SessionState.SignedIn("u"))
        val vm = viewModel(accounts)
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { vm.state.collect {} }

        vm.signOut()

        assertEquals(1, accounts.signOuts)
        assertEquals(ProfileState.SignedOut, vm.state.value.profile)
        assertTrue(!vm.state.value.signingOut)
    }

    @Test
    fun `sin sesion no hay perfil`() = runTest {
        val vm = viewModel(FakeAccounts(SessionState.SignedOut))
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { vm.state.collect {} }
        assertEquals(ProfileState.SignedOut, vm.state.value.profile)
    }

    @Test
    fun `error al leer el perfil es Unavailable y reintentar lo recupera`() = runTest {
        val accounts = FakeAccounts(SessionState.SignedIn("u"), AccountResult.Failure(AccountFailure.Network))
        val vm = viewModel(accounts)
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { vm.state.collect {} }
        assertEquals(ProfileState.Unavailable, vm.state.value.profile)

        accounts.profileResult = AccountResult.Success(testProfile)
        vm.retry()

        assertEquals(ProfileState.Ready(testProfile), vm.state.value.profile)
    }

    @Test
    fun `el saludo de inicio usa solo el primer nombre y desaparece al cerrar sesion`() = runTest {
        val accounts = FakeAccounts(SessionState.SignedIn("u"))
        val vm = InicioViewModel(ObserveMyProfileUseCase(accounts))
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { vm.firstName.collect {} }
        assertEquals("Ana", vm.firstName.value)

        accounts.sessionFlow.value = SessionState.SignedOut
        assertNull(vm.firstName.value)
    }
}
