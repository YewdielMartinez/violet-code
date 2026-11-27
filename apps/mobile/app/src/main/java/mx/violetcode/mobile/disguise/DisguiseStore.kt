package mx.violetcode.mobile.disguise

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import mx.violetcode.mobile.core.domain.disguise.PinStore
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Almacén del modo discreto. El PIN nunca se guarda: solo su hash PBKDF2 con sal
 * ([mx.violetcode.mobile.core.domain.disguise.PinHasher]), y ese texto además se cifra con AES-GCM usando
 * una llave de Android Keystore que no sale del dispositivo (sin respaldos: allowBackup=false).
 * Si el descifrado falla (llave invalidada), el PIN se considera no configurado.
 *
 * Los contadores de intentos fallidos y la preferencia de «sitio neutro» no son secretos y van en claro.
 */
class DisguiseStore(context: Context) : PinStore {
    private val prefs = context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    var enabled: Boolean
        get() = prefs.getBoolean(KEY_ENABLED, false)
        set(value) = prefs.edit().putBoolean(KEY_ENABLED, value).apply()

    /** Al usar «Salir rápido» (sin modo discreto) abrir un sitio neutro en vez de ir al inicio. */
    var neutralSiteOnExit: Boolean
        get() = prefs.getBoolean(KEY_NEUTRAL_SITE, false)
        set(value) = prefs.edit().putBoolean(KEY_NEUTRAL_SITE, value).apply()

    override var credential: String?
        get() {
            val stored = prefs.getString(KEY_CREDENTIAL, null) ?: return null
            return try {
                val payload = Base64.decode(stored, Base64.NO_WRAP)
                val iv = payload.copyOfRange(0, IV_BYTES)
                val cipher = Cipher.getInstance(TRANSFORMATION)
                    .apply { init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(TAG_BITS, iv)) }
                cipher.doFinal(payload, IV_BYTES, payload.size - IV_BYTES).toString(Charsets.UTF_8)
            } catch (e: Exception) {
                null
            }
        }
        set(value) {
            if (value == null) {
                prefs.edit().remove(KEY_CREDENTIAL).apply()
                return
            }
            val cipher = Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.ENCRYPT_MODE, secretKey()) }
            val payload = cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8))
            prefs.edit().putString(KEY_CREDENTIAL, Base64.encodeToString(payload, Base64.NO_WRAP)).apply()
        }

    override var failures: Int
        get() = prefs.getInt(KEY_FAILURES, 0)
        set(value) = prefs.edit().putInt(KEY_FAILURES, value).apply()

    override var lockedUntilMillis: Long
        get() = prefs.getLong(KEY_LOCKED_UNTIL, 0)
        set(value) = prefs.edit().putLong(KEY_LOCKED_UNTIL, value).apply()

    private fun secretKey(): SecretKey {
        val store = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        (store.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return generator.generateKey()
    }

    private companion object {
        // Nombres de archivo y de llave genéricos: no delatan la función.
        const val FILE = "app_state"
        const val KEY_ENABLED = "m"
        const val KEY_NEUTRAL_SITE = "n"
        const val KEY_CREDENTIAL = "c"
        const val KEY_FAILURES = "f"
        const val KEY_LOCKED_UNTIL = "l"
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val KEY_ALIAS = "app_state_key"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_BYTES = 12
        const val TAG_BITS = 128
    }
}
