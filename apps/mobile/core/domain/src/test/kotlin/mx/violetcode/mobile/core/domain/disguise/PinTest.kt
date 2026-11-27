package mx.violetcode.mobile.core.domain.disguise

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PinTest {
    // Pocas iteraciones: la prueba verifica la lógica, no el costo del KDF.
    private val hasher = PinHasher(iterations = 1_000)

    private class MemoryStore : PinStore {
        override var credential: String? = null
        override var failures: Int = 0
        override var lockedUntilMillis: Long = 0
    }

    @Test
    fun `formato valido es de 4 a 6 digitos`() {
        assertFalse(PinPolicy.isValidFormat("123"))
        assertTrue(PinPolicy.isValidFormat("1234"))
        assertTrue(PinPolicy.isValidFormat("000000"))
        assertFalse(PinPolicy.isValidFormat("1234567"))
        assertFalse(PinPolicy.isValidFormat("12a4"))
        assertFalse(PinPolicy.isValidFormat(""))
    }

    @Test
    fun `el PIN correcto verifica y el incorrecto no`() {
        val credential = hasher.hash("4821")
        assertTrue(hasher.verify("4821", credential))
        assertFalse(hasher.verify("4822", credential))
        assertFalse(hasher.verify("482", credential))
        assertFalse(hasher.verify("", credential))
    }

    @Test
    fun `la sal hace distintos los hashes del mismo PIN`() {
        val a = hasher.hash("4821")
        val b = hasher.hash("4821")
        assertNotEquals(a.encode(), b.encode())
        assertTrue(hasher.verify("4821", a) && hasher.verify("4821", b))
    }

    @Test
    fun `lo guardado no contiene el PIN`() {
        val encoded = hasher.hash("987654").encode()
        assertFalse(encoded.contains("987654"))
    }

    @Test
    fun `codifica y decodifica la credencial`() {
        val credential = hasher.hash("2468")
        val decoded = PinCredential.decode(credential.encode())
        assertEquals(credential, decoded)
        assertTrue(hasher.verify("2468", decoded!!))
    }

    @Test
    fun `una credencial corrupta se rechaza`() {
        assertNull(PinCredential.decode("basura"))
        assertNull(PinCredential.decode("v2\$1\$AA==\$AA=="))
        assertNull(PinCredential.decode("v1\$x\$AA==\$AA=="))
        assertNull(PinCredential.decode("v1\$1\$***\$AA=="))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `no se puede guardar un PIN invalido`() {
        hasher.hash("12")
    }

    // ---- Retraso ante intentos fallidos ----

    @Test
    fun `los primeros fallos no tienen retraso y luego se duplica hasta un tope`() {
        assertEquals(0, PinLockoutPolicy.lockoutMillisAfter(0))
        assertEquals(0, PinLockoutPolicy.lockoutMillisAfter(4))
        assertEquals(30_000, PinLockoutPolicy.lockoutMillisAfter(5))
        assertEquals(60_000, PinLockoutPolicy.lockoutMillisAfter(6))
        assertEquals(120_000, PinLockoutPolicy.lockoutMillisAfter(7))
        assertEquals(15 * 60_000L, PinLockoutPolicy.lockoutMillisAfter(50))
        assertEquals(15 * 60_000L, PinLockoutPolicy.lockoutMillisAfter(Int.MAX_VALUE))
    }

    @Test
    fun `sin PIN configurado no hay nada que comprobar`() {
        assertEquals(PinCheck.NotConfigured, PinGate(MemoryStore(), hasher).check("1234"))
    }

    @Test
    fun `el PIN correcto desbloquea y reinicia los fallos`() {
        val store = MemoryStore()
        val gate = PinGate(store, hasher) { 1_000 }
        gate.setPin("1234")
        assertTrue(gate.isConfigured)
        gate.check("0000")
        assertEquals(1, store.failures)
        assertEquals(PinCheck.Correct, gate.check("1234"))
        assertEquals(0, store.failures)
    }

    @Test
    fun `tras cinco fallos se bloquea y ni el PIN correcto entra durante el bloqueo`() {
        val store = MemoryStore()
        var now = 1_000_000L
        val gate = PinGate(store, hasher) { now }
        gate.setPin("1234")

        repeat(5) { assertEquals(PinCheck.Wrong, gate.check("9999")) }
        assertEquals(now + 30_000, store.lockedUntilMillis)

        val locked = gate.check("1234")
        assertTrue(locked is PinCheck.LockedOut)
        assertEquals(30_000L, (locked as PinCheck.LockedOut).remainingMillis)

        now += 29_999
        assertTrue(gate.check("1234") is PinCheck.LockedOut)

        now += 1
        assertEquals(PinCheck.Correct, gate.check("1234"))
    }

    @Test
    fun `un fallo despues del bloqueo lo duplica`() {
        val store = MemoryStore()
        var now = 0L
        val gate = PinGate(store, hasher) { now }
        gate.setPin("1234")
        repeat(5) { gate.check("9999") }
        now += 30_000
        assertEquals(PinCheck.Wrong, gate.check("9999")) // fallo 6 → 60 s
        assertEquals(now + 60_000, store.lockedUntilMillis)
    }

    @Test
    fun `los intentos bloqueados no cuentan como fallos nuevos`() {
        val store = MemoryStore()
        val gate = PinGate(store, hasher) { 0 }
        gate.setPin("1234")
        repeat(5) { gate.check("9999") }
        repeat(10) { gate.check("9999") }
        assertEquals(5, store.failures)
    }

    @Test
    fun `cambiar el PIN limpia fallos y bloqueo`() {
        val store = MemoryStore()
        val gate = PinGate(store, hasher) { 0 }
        gate.setPin("1234")
        repeat(5) { gate.check("9999") }
        gate.setPin("5678")
        assertEquals(0, store.failures)
        assertEquals(0L, store.lockedUntilMillis)
        assertEquals(PinCheck.Correct, gate.check("5678"))
    }

    @Test
    fun `clear quita el PIN`() {
        val store = MemoryStore()
        val gate = PinGate(store, hasher)
        gate.setPin("1234")
        gate.clear()
        assertFalse(gate.isConfigured)
        assertNull(store.credential)
        assertNotNull(PinCheck.NotConfigured)
    }
}
