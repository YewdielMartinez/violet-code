package mx.violetcode.mobile.core.domain.validation

/** Reglas de captura del lado del dispositivo. El servidor las vuelve a validar (RNF-03). */
object RegistrationValidator {
    // Mismo patrón que `pre_registro.curp` en la base (01_base / 02_atencion).
    private val CURP = Regex(
        "^[A-Z][AEIOUX][A-Z]{2}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[HM]" +
            "(AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)" +
            "[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z][0-9]$",
    )
    private val EMAIL = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]{2,}$")
    private val CELULAR = Regex("^[0-9]{10}$")

    const val MIN_PASSWORD_LENGTH = 8
    const val MAX_NAME_LENGTH = 100

    fun normalizeCurp(raw: String): String = raw.filterNot { it.isWhitespace() }.uppercase()

    fun isValidCurp(raw: String): Boolean = CURP.matches(normalizeCurp(raw))

    fun isValidEmail(raw: String): Boolean = EMAIL.matches(raw.trim())

    fun isValidPassword(raw: String): Boolean = raw.length >= MIN_PASSWORD_LENGTH

    fun isValidName(raw: String): Boolean = raw.trim().length in 1..MAX_NAME_LENGTH

    /** Solo dígitos, exactamente 10. Vacío es válido (el celular es opcional). */
    fun isValidCelular(raw: String): Boolean = raw.isEmpty() || CELULAR.matches(raw)
}
