package mx.violetcode.mobile.core.domain.account

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import mx.violetcode.mobile.core.domain.usecase.ObserveMyProfileUseCase
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

private val ana = UserProfile(
    nombres = "Ana María", apellidoPaterno = "Romero", apellidoMaterno = "Díaz",
    email = "ana@example.com", curp = "ROMA900101MDFDRN09", celular = "6681234567",
)

private class ProfileAccounts(
    initial: SessionState,
    var result: AccountResult<UserProfile?>,
) : AccountRepository {
    val sessionFlow = MutableStateFlow(initial)
    var loads = 0
    override val session: StateFlow<SessionState> = sessionFlow
    override suspend fun signUp(data: RegistrationData) = AccountResult.Success(SignUpOutcome.CheckEmail)
    override suspend fun signIn(email: String, password: String) = AccountResult.Success(Unit)
    override suspend fun signOut() { sessionFlow.value = SessionState.SignedOut }
    override suspend fun ensureProfile(): AccountResult<Boolean> = AccountResult.Success(true)
    override suspend fun getMyProfile(): AccountResult<UserProfile?> { loads++; return result }
}

class ProfileMaskingTest {
    @Test fun `curp muestra 4 primeros y 2 ultimos`() {
        assertEquals("ROMA******09", ProfileMasking.maskCurp("ROMA900101MDFDRN09"))
        assertEquals("ROMA******09", ProfileMasking.maskCurp(" ROMA900101MDFDRN09 "))
    }

    @Test fun `curp corta se oculta completa`() {
        assertEquals("******", ProfileMasking.maskCurp("ABC"))
        assertEquals("******", ProfileMasking.maskCurp(""))
    }

    @Test fun `celular muestra solo los ultimos 4`() {
        assertEquals("******4567", ProfileMasking.maskCelular("6681234567"))
        assertEquals("******", ProfileMasking.maskCelular("123"))
    }

    @Test fun `iniciales y nombres`() {
        assertEquals("AR", ana.initials)
        assertEquals("Ana", ana.firstName)
        assertEquals("Ana María Romero Díaz", ana.fullName)
        assertEquals("?", ProfileMasking.initials("", ""))
        assertEquals("L", ProfileMasking.initials("  lucía", ""))
    }

    @Test fun `nombre completo omite apellido materno ausente y el celular vacio no se muestra`() {
        val p = ana.copy(apellidoMaterno = null, celular = "")
        assertEquals("Ana María Romero", p.fullName)
        assertNull(p.maskedCelular)
        assertEquals("ROMA******09", p.maskedCurp)
    }
}

class ObserveMyProfileUseCaseTest {
    private suspend fun settled(accounts: AccountRepository): ProfileState =
        ObserveMyProfileUseCase(accounts)().first { it != ProfileState.Loading }

    @Test fun `sin sesion no consulta el perfil`() = runTest {
        val accounts = ProfileAccounts(SessionState.SignedOut, AccountResult.Success(ana))
        assertEquals(ProfileState.SignedOut, settled(accounts))
        assertEquals(0, accounts.loads)
    }

    @Test fun `con sesion y perfil termina en Ready`() = runTest {
        val accounts = ProfileAccounts(SessionState.SignedIn("u"), AccountResult.Success(ana))
        assertEquals(ProfileState.Ready(ana), settled(accounts))
    }

    @Test fun `perfil inexistente o error de red es Unavailable sin distinguir la causa`() = runTest {
        assertEquals(ProfileState.Unavailable, settled(ProfileAccounts(SessionState.SignedIn("u"), AccountResult.Success(null))))
        assertEquals(
            ProfileState.Unavailable,
            settled(ProfileAccounts(SessionState.SignedIn("u"), AccountResult.Failure(AccountFailure.Network))),
        )
    }

    @Test fun `sesion expirada durante la lectura se trata como sin sesion`() = runTest {
        val accounts = ProfileAccounts(SessionState.SignedIn("u"), AccountResult.Failure(AccountFailure.NotSignedIn))
        assertEquals(ProfileState.SignedOut, settled(accounts))
    }
}
