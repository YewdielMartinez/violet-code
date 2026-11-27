package mx.violetcode.mobile.core.domain.disguise

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CalculatorEngineTest {

    /** "12+3=" → listOf(d1, d2, +, d3, =) */
    private fun press(vararg keys: String, from: CalculatorState = CalculatorState()): CalculatorState =
        keys.fold(from) { s, k -> CalculatorEngine.reduce(s, key(k)) }

    private fun key(k: String): CalcKey = when (k) {
        "+" -> CalcKey.Operator(CalcOp.Add)
        "-" -> CalcKey.Operator(CalcOp.Subtract)
        "*" -> CalcKey.Operator(CalcOp.Multiply)
        "/" -> CalcKey.Operator(CalcOp.Divide)
        "=" -> CalcKey.Equals
        "C" -> CalcKey.Clear
        "<" -> CalcKey.Backspace
        "n" -> CalcKey.ToggleSign
        "%" -> CalcKey.Percent
        "." -> CalcKey.Decimal
        else -> CalcKey.Digit(k.single().digitToInt())
    }

    private fun run(expr: String) = press(*expr.map(Char::toString).toTypedArray())

    @Test
    fun `estado inicial muestra cero`() {
        assertEquals("0", CalculatorState().display)
    }

    @Test
    fun `suma resta multiplica y divide`() {
        assertEquals("5", run("2+3=").display)
        assertEquals("4", run("9-5=").display)
        assertEquals("42", run("6*7=").display)
        assertEquals("4", run("8/2=").display)
    }

    @Test
    fun `encadena operaciones de izquierda a derecha como calculadora de bolsillo`() {
        assertEquals("9", run("1+2*3=").display)
    }

    @Test
    fun `los ceros a la izquierda no se acumulan en pantalla`() {
        assertEquals("7", run("007").display)
    }

    @Test
    fun `decimales`() {
        assertEquals("0.3", run("0.1+0.2=").display)
        assertEquals("0.5", run(".5").display)
        assertEquals("1.5", run("1.5").display)
        assertEquals("1.25", run("1.2.5").display)
    }

    @Test
    fun `division entre cero da error hasta limpiar`() {
        val s = run("5/0=")
        assertEquals("Error", s.display)
        assertEquals("Error", press("+", "=", from = s).display)
        assertEquals("0", press("C", from = s).display)
    }

    @Test
    fun `teclear un digito tras un error empieza de nuevo`() {
        assertEquals("4", press("4", from = run("5/0=")).display)
    }

    @Test
    fun `igual repetido repite la ultima operacion`() {
        assertEquals("8", run("2+3==").display)
        assertEquals("11", run("2+3===").display)
    }

    @Test
    fun `igual sin segundo operando usa el valor en pantalla`() {
        assertEquals("10", run("5+=").display)
    }

    @Test
    fun `operar despues de igual continua con el resultado`() {
        assertEquals("15", run("2+3=*3=").display)
    }

    @Test
    fun `cambiar de operador antes de teclear el segundo numero reemplaza al anterior`() {
        assertEquals("6", run("2+*3=").display)
    }

    @Test
    fun `borrar quita el ultimo digito`() {
        assertEquals("12", run("123<").display)
        assertEquals("0", run("5<").display)
    }

    @Test
    fun `cambia el signo`() {
        assertEquals("-5", run("5n").display)
        assertEquals("5", run("5nn").display)
        assertEquals("0", run("n").display)
        assertEquals("-2", run("3n+1=").display)
    }

    @Test
    fun `porcentaje`() {
        assertEquals("0.5", run("50%").display)
        assertEquals("10", run("200+5%").display)
    }

    @Test
    fun `porcentaje sobre el acumulado en una suma`() {
        // 200 + 10% = 200 + 20 = 220
        assertEquals("20", run("200+10%").display)
        assertEquals("220", run("200+10%=").display)
    }

    @Test
    fun `limpiar reinicia todo`() {
        assertEquals("0", run("12+3C").display)
        assertEquals("", run("12+3C").history)
    }

    @Test
    fun `historial muestra la operacion pendiente`() {
        assertEquals("12 +", run("12+").history)
        assertEquals("", run("12+3=").history)
    }

    @Test
    fun `limita la longitud de lo tecleado`() {
        assertEquals("123456789012", run("12345678901234567890").display)
    }

    @Test
    fun `resultados largos se redondean`() {
        assertEquals("0.333333333333", run("1/3=").display)
    }

    // ---- Candidato a PIN (el desbloqueo solo observa lo tecleado) ----

    @Test
    fun `de 4 a 6 digitos sueltos son candidato a PIN`() {
        assertNull(run("123").pinCandidate)
        assertEquals("1234", run("1234").pinCandidate)
        assertEquals("123456", run("123456").pinCandidate)
        assertNull(run("1234567").pinCandidate)
    }

    @Test
    fun `el PIN conserva ceros a la izquierda`() {
        assertEquals("0042", run("0042").pinCandidate)
        assertNull(run("1234.5678").pinCandidate)
    }

    @Test
    fun `una operacion o un decimal descartan el candidato`() {
        assertNull(run("12+34").pinCandidate)
        assertNull(run("12.34").pinCandidate)
        assertNull(run("1234+").pinCandidate)
        assertNull(run("1234=").pinCandidate)
        assertNull(run("1234n").pinCandidate)
    }

    @Test
    fun `borrar ajusta el candidato`() {
        assertEquals("1234", run("12345<").pinCandidate)
    }

    @Test
    fun `tras un resultado ya no hay candidato hasta teclear digitos nuevos`() {
        val afterEquals = run("2+2=")
        assertNull(afterEquals.pinCandidate)
        assertEquals("5555", press("5", "5", "5", "5", from = afterEquals).pinCandidate)
    }

    @Test
    fun `leer el candidato no cambia lo que muestra la calculadora`() {
        val s = run("4821")
        assertEquals("4821", s.pinCandidate)
        assertEquals("4821", press("=", from = s).display)
    }
}
