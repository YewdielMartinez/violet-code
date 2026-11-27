package mx.violetcode.mobile.core.data.supabase

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import io.github.jan.supabase.auth.SessionManager
import io.github.jan.supabase.auth.user.UserSession
import kotlinx.serialization.json.Json
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Guarda la sesión de Supabase cifrada con AES-GCM; la llave vive en Android Keystore y nunca sale del
 * dispositivo (RNF-04). Sin respaldos en la nube (allowBackup=false). Si el descifrado falla (llave
 * invalidada, datos corruptos) la sesión se descarta y la usuaria vuelve a iniciar sesión.
 */
internal class KeystoreSessionManager(context: Context) : SessionManager {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun saveSession(session: UserSession) {
        val plain = json.encodeToString(UserSession.serializer(), session).toByteArray(Charsets.UTF_8)
        val cipher = Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.ENCRYPT_MODE, secretKey()) }
        val payload = cipher.iv + cipher.doFinal(plain)
        prefs.edit().putString(KEY_SESSION, Base64.encodeToString(payload, Base64.NO_WRAP)).apply()
    }

    override suspend fun loadSession(): UserSession? {
        val stored = prefs.getString(KEY_SESSION, null) ?: return null
        return try {
            val payload = Base64.decode(stored, Base64.NO_WRAP)
            val iv = payload.copyOfRange(0, IV_BYTES)
            val cipher = Cipher.getInstance(TRANSFORMATION)
                .apply { init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(TAG_BITS, iv)) }
            val plain = cipher.doFinal(payload, IV_BYTES, payload.size - IV_BYTES)
            json.decodeFromString(UserSession.serializer(), plain.toString(Charsets.UTF_8))
        } catch (e: Exception) {
            deleteSession()
            null
        }
    }

    override suspend fun deleteSession() {
        prefs.edit().remove(KEY_SESSION).apply()
    }

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
        const val PREFS = "violet_session"
        const val KEY_SESSION = "session"
        const val KEY_ALIAS = "violet_session_key"
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_BYTES = 12
        const val TAG_BITS = 128
    }
}
