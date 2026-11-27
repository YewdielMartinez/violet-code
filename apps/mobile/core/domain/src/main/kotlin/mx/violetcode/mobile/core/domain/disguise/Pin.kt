package mx.violetcode.mobile.core.domain.disguise

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

object PinPolicy {
    const val MIN_LENGTH = 4
    const val MAX_LENGTH = 6

    fun isValidFormat(pin: String): Boolean = pin.length in MIN_LENGTH..MAX_LENGTH && pin.all { it in '0'..'9' }
}

/** PIN guardado: sal aleatoria + PBKDF2-HMAC-SHA256. Nunca contiene el PIN en claro. */
data class PinCredential(val iterations: Int, val salt: ByteArray, val hash: ByteArray) {
    /** `v1$iteraciones$sal$hash` (Base64). */
    fun encode(): String {
        val b64 = Base64.getEncoder()
        return listOf("v1", iterations.toString(), b64.encodeToString(salt), b64.encodeToString(hash)).joinToString(SEPARATOR)
    }

    override fun equals(other: Any?): Boolean =
        other is PinCredential && iterations == other.iterations && salt.contentEquals(other.salt) && hash.contentEquals(other.hash)

    override fun hashCode(): Int = 31 * (31 * iterations + salt.contentHashCode()) + hash.contentHashCode()

    companion object {
        private const val SEPARATOR = "$"

        fun decode(text: String): PinCredential? {
            val parts = text.split(SEPARATOR)
            if (parts.size != 4 || parts[0] != "v1") return null
            return try {
                val b64 = Base64.getDecoder()
                PinCredential(parts[1].toInt(), b64.decode(parts[2]), b64.decode(parts[3]))
            } catch (e: IllegalArgumentException) {
                null
            }
        }
    }
}

class PinHasher(
    private val iterations: Int = DEFAULT_ITERATIONS,
    private val random: SecureRandom = SecureRandom(),
) {
    fun hash(pin: String): PinCredential {
        require(PinPolicy.isValidFormat(pin)) { "El PIN debe tener de 4 a 6 dígitos" }
        val salt = ByteArray(SALT_BYTES).also(random::nextBytes)
        return PinCredential(iterations, salt, derive(pin, salt, iterations))
    }

    /** Comparación en tiempo constante. Un PIN con formato inválido nunca coincide. */
    fun verify(pin: String, credential: PinCredential): Boolean {
        if (!PinPolicy.isValidFormat(pin)) return false
        val candidate = derive(pin, credential.salt, credential.iterations)
        return MessageDigest.isEqual(candidate, credential.hash)
    }

    private fun derive(pin: String, salt: ByteArray, iterations: Int): ByteArray {
        val spec = PBEKeySpec(pin.toCharArray(), salt, iterations, KEY_BITS)
        try {
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
        } finally {
            spec.clearPassword()
        }
    }

    companion object {
        const val DEFAULT_ITERATIONS = 120_000
        private const val SALT_BYTES = 16
        private const val KEY_BITS = 256
    }
}

/**
 * Retraso ante intentos fallidos (un PIN de 4–6 dígitos no se puede dejar sin freno).
 * Los primeros [FREE_ATTEMPTS] fallos no cuestan nada; después el bloqueo se duplica: 30 s, 1 min, 2 min…
 * hasta un máximo de 15 min.
 */
object PinLockoutPolicy {
    const val FREE_ATTEMPTS = 4
    private const val BASE_MILLIS = 30_000L
    private const val MAX_MILLIS = 15 * 60_000L

    fun lockoutMillisAfter(consecutiveFailures: Int): Long {
        if (consecutiveFailures <= FREE_ATTEMPTS) return 0
        val doublings = (consecutiveFailures - FREE_ATTEMPTS - 1).coerceAtMost(10)
        return (BASE_MILLIS shl doublings).coerceAtMost(MAX_MILLIS)
    }
}

/** Almacenamiento del PIN y del conteo de fallos (en la app: cifrado con Android Keystore). */
interface PinStore {
    var credential: String?
    var failures: Int
    var lockedUntilMillis: Long
}

sealed interface PinCheck {
    data object Correct : PinCheck
    data object Wrong : PinCheck

    /** Bloqueado: ni siquiera se compara el PIN. La pantalla NO debe mostrar nada especial. */
    data class LockedOut(val remainingMillis: Long) : PinCheck

    data object NotConfigured : PinCheck
}

class PinGate(
    private val store: PinStore,
    private val hasher: PinHasher = PinHasher(),
    private val clock: () -> Long = System::currentTimeMillis,
) {
    val isConfigured: Boolean get() = store.credential?.let(PinCredential::decode) != null

    fun setPin(pin: String) {
        store.credential = hasher.hash(pin).encode()
        store.failures = 0
        store.lockedUntilMillis = 0
    }

    fun clear() {
        store.credential = null
        store.failures = 0
        store.lockedUntilMillis = 0
    }

    fun check(pin: String): PinCheck {
        val credential = store.credential?.let(PinCredential::decode) ?: return PinCheck.NotConfigured
        val now = clock()
        val lockedUntil = store.lockedUntilMillis
        // Si el reloj se atrasó (lockedUntil demasiado lejano), se limita al máximo posible.
        if (lockedUntil > now) return PinCheck.LockedOut((lockedUntil - now).coerceAtMost(PinLockoutPolicy.lockoutMillisAfter(Int.MAX_VALUE)))

        return if (hasher.verify(pin, credential)) {
            store.failures = 0
            store.lockedUntilMillis = 0
            PinCheck.Correct
        } else {
            val failures = store.failures + 1
            store.failures = failures
            store.lockedUntilMillis = now + PinLockoutPolicy.lockoutMillisAfter(failures)
            PinCheck.Wrong
        }
    }
}
