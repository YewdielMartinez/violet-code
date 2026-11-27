package mx.violetcode.mobile.core.domain.account

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.test.runTest
import mx.violetcode.mobile.core.domain.usecase.SendHelpAlertUseCase
import mx.violetcode.mobile.core.domain.usecase.SignUpUseCase
import mx.violetcode.mobile.core.domain.validation.RegistrationValidator
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

private class FakeAccounts(
    initial: SessionState = SessionState.SignedOut,
    private val profileReady: Boolean = true,
) : AccountRepository {
    override val session: StateFlow<SessionState> = MutableStateFlow(initial)
    var signUps = 0
    override suspend fun signUp(data: RegistrationData): AccountResult<SignUpOutcome> {
        signUps++
        return AccountResult.Success(SignUpOutcome.CheckEmail)
    }
    override suspend fun signIn(email: String, password: String) = AccountResult.Success(Unit)
    override suspend fun signOut() = Unit
    override suspend fun ensureProfile(): AccountResult<Boolean> = AccountResult.Success(profileReady)
}

private class FakeAlerts : AlertRepository {
    var sent = 0
    override suspend fun sendHelpAlert(): AccountResult<AlertReceipt> {
        sent++
        return AccountResult.Success(AlertReceipt("a1"))
    }
}

class AccountUseCasesTest {
    private val valid = RegistrationData(
        email = "ana@example.com", password = "12345678", curp = "ROMA900101MDFDRN09",
        nombres = "Ana", apellidoPaterno = "Roma", apellidoMaterno = null, celular = null,
        avisoPrivacidadAceptado = true,
    )

    @Test fun `curp valida e invalida`() {
        assertTrue(RegistrationValidator.isValidCurp(" roma900101mdfdrn09 "))
        assertFalse(RegistrationValidator.isValidCurp("ROMA900101MDFDRN"))
        assertFalse(RegistrationValidator.isValidCurp("ROMA901301MDFDRN09"))
    }

    @Test fun `registro exige aviso de privacidad y no llega al servidor`() = runTest {
        val accounts = FakeAccounts()
        val result = SignUpUseCase(accounts)(valid.copy(avisoPrivacidadAceptado = false))
        assertEquals(AccountResult.Failure(AccountFailure.InvalidData), result)
        assertEquals(0, accounts.signUps)
    }

    @Test fun `registro valido llega al servidor`() = runTest {
        val accounts = FakeAccounts()
        assertTrue(SignUpUseCase(accounts)(valid) is AccountResult.Success)
        assertEquals(1, accounts.signUps)
    }

    @Test fun `alerta sin sesion no se envia`() = runTest {
        val alerts = FakeAlerts()
        val result = SendHelpAlertUseCase(FakeAccounts(SessionState.SignedOut), alerts)()
        assertEquals(AccountResult.Failure(AccountFailure.NotSignedIn), result)
        assertEquals(0, alerts.sent)
    }

    @Test fun `alerta sin perfil no se envia`() = runTest {
        val alerts = FakeAlerts()
        val result = SendHelpAlertUseCase(FakeAccounts(SessionState.SignedIn("u"), profileReady = false), alerts)()
        assertEquals(AccountResult.Failure(AccountFailure.ProfileMissing), result)
        assertEquals(0, alerts.sent)
    }

    @Test fun `alerta con sesion y perfil se envia`() = runTest {
        val alerts = FakeAlerts()
        assertTrue(SendHelpAlertUseCase(FakeAccounts(SessionState.SignedIn("u")), alerts)() is AccountResult.Success)
        assertEquals(1, alerts.sent)
    }
}
