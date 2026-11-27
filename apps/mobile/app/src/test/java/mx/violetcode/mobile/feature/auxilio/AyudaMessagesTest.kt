package mx.violetcode.mobile.feature.auxilio

import mx.violetcode.mobile.core.domain.account.AccountFailure
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AyudaMessagesTest {

    @Test
    fun limitReachedShowsCalmMessageWith911() {
        val message = AccountFailure.AlertLimitReached.helpMessage()
        assertEquals(
            "Ya enviaste varias solicitudes en la última hora. Si estás en peligro, llama al 911.",
            message,
        )
        assertTrue(message.contains("911"))
    }

    @Test
    fun otherErrorsStayGeneric() {
        assertEquals("No se pudo enviar la alerta.", AccountFailure.Unexpected.helpMessage())
        assertEquals("No se pudo enviar la alerta.", AccountFailure.TooManyRequests.helpMessage())
        assertFalse(AccountFailure.Network.helpMessage().contains("911"))
        assertFalse(AccountFailure.Unexpected.helpMessage().contains("911"))
    }
}
