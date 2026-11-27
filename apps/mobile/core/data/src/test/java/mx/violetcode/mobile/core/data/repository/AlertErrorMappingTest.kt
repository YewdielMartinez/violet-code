package mx.violetcode.mobile.core.data.repository

import mx.violetcode.mobile.core.domain.account.AccountFailure
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AlertErrorMappingTest {

    @Test
    fun rateLimitErrorMapsToAlertLimitReached() {
        // Texto de la migración 46 (SQLSTATE 23514).
        assertEquals(
            AccountFailure.AlertLimitReached,
            alertFailureFor("Alcanzaste el límite de 3 alertas por hora"),
        )
        assertEquals(
            AccountFailure.AlertLimitReached,
            alertFailureFor("ALCANZASTE EL LIMITE DE 3 ALERTAS POR HORA"),
        )
    }

    @Test
    fun missingProfileMapsToProfileMissing() {
        assertEquals(AccountFailure.ProfileMissing, alertFailureFor("Tu cuenta no tiene perfil de pre-registro"))
    }

    @Test
    fun unknownOrEmptyErrorsAreNotClassified() {
        assertNull(alertFailureFor("duplicate key value violates unique constraint"))
        assertNull(alertFailureFor(""))
        assertNull(alertFailureFor(null))
    }
}
