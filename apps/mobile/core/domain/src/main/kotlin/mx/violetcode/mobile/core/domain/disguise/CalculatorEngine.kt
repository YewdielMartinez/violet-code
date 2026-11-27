package mx.violetcode.mobile.core.domain.disguise

import java.math.BigDecimal
import java.math.MathContext

/**
 * Motor de una calculadora básica de 4 operaciones (modo discreto). Es una calculadora real:
 * el desbloqueo por PIN solo *observa* lo tecleado ([CalculatorState.pinCandidate]); nunca cambia
 * cómo se comporta ni lo que se ve.
 *
 * Modelo "de bolsillo": la operación se ejecuta al teclear la siguiente (1 + 2 × 3 = 9), "=" repetido
 * repite la última operación, y dividir entre cero muestra "Error" hasta pulsar C.
 */
enum class CalcOp(val symbol: String) {
    Add("+"), Subtract("−"), Multiply("×"), Divide("÷"),
}

sealed interface CalcKey {
    data class Digit(val value: Int) : CalcKey {
        init {
            require(value in 0..9)
        }
    }

    data object Decimal : CalcKey
    data class Operator(val op: CalcOp) : CalcKey
    data object Equals : CalcKey
    data object Clear : CalcKey
    data object Backspace : CalcKey
    data object ToggleSign : CalcKey
    data object Percent : CalcKey
}

data class CalculatorState(
    /** Lo que muestra la pantalla principal. */
    val entry: String = "0",
    internal val acc: BigDecimal? = null,
    internal val op: CalcOp? = null,
    internal val startNewEntry: Boolean = false,
    internal val justEvaluated: Boolean = false,
    internal val lastOp: CalcOp? = null,
    internal val lastOperand: BigDecimal? = null,
    internal val error: Boolean = false,
    /** Dígitos tecleados desde cero, con ceros a la izquierda, mientras no haya operación. */
    internal val typed: String = "",
) {
    val display: String get() = if (error) "Error" else entry

    /** Línea secundaria, p. ej. "12 +". Vacía si no hay operación pendiente. */
    val history: String get() = if (error || acc == null || op == null) "" else "${CalculatorEngine.format(acc)} ${op.symbol}"

    /**
     * Si lo tecleado hasta ahora son solo 4–6 dígitos sueltos (posible PIN), los devuelve.
     * Se debe leer ANTES de aplicar "=".
     */
    val pinCandidate: String?
        get() = typed.takeIf {
            !error && acc == null && op == null && !justEvaluated && entry.all(Char::isDigit) &&
                it.length in PinPolicy.MIN_LENGTH..PinPolicy.MAX_LENGTH && it.all(Char::isDigit)
        }
}

object CalculatorEngine {
    private const val MAX_DIGITS = 12
    private val MC = MathContext(12)

    fun reduce(state: CalculatorState, key: CalcKey): CalculatorState {
        if (state.error && key != CalcKey.Clear && key !is CalcKey.Digit && key != CalcKey.Decimal) return state
        return when (key) {
            is CalcKey.Digit -> digit(if (state.error) CalculatorState() else state, key.value)
            CalcKey.Decimal -> decimal(if (state.error) CalculatorState() else state)
            is CalcKey.Operator -> operator(state, key.op)
            CalcKey.Equals -> equals(state)
            CalcKey.Clear -> CalculatorState()
            CalcKey.Backspace -> backspace(state)
            CalcKey.ToggleSign -> toggleSign(state)
            CalcKey.Percent -> percent(state)
        }
    }

    fun reduce(state: CalculatorState, keys: List<CalcKey>): CalculatorState = keys.fold(state, ::reduce)

    private fun digit(s: CalculatorState, d: Int): CalculatorState {
        val fresh = s.justEvaluated
        val base = if (fresh) CalculatorState() else s
        val replacing = base.startNewEntry || base.entry == "0"
        val newEntry = when {
            base.startNewEntry -> "$d"
            base.entry == "0" -> "$d"
            base.entry == "-0" -> "-$d"
            base.entry.count(Char::isDigit) >= MAX_DIGITS -> base.entry
            else -> base.entry + d
        }
        val collecting = base.acc == null && base.op == null
        val typed = when {
            !collecting -> ""
            newEntry == base.entry && !replacing -> base.typed // tope de dígitos
            else -> base.typed + d
        }
        return base.copy(entry = newEntry, startNewEntry = false, justEvaluated = false, typed = typed)
    }

    private fun decimal(s: CalculatorState): CalculatorState {
        val base = if (s.justEvaluated) CalculatorState() else s
        val newEntry = when {
            base.startNewEntry -> "0."
            '.' in base.entry -> base.entry
            else -> base.entry + "."
        }
        return base.copy(entry = newEntry, startNewEntry = false, justEvaluated = false, typed = "")
    }

    private fun operator(s: CalculatorState, op: CalcOp): CalculatorState {
        val current = value(s.entry)
        return when {
            s.justEvaluated -> s.copy(acc = current, op = op, startNewEntry = true, justEvaluated = false, typed = "")
            s.op != null && s.startNewEntry -> s.copy(op = op) // cambió de opinión: solo reemplaza
            s.op != null && s.acc != null -> {
                val result = apply(s.acc, s.op, current) ?: return errorState()
                s.copy(entry = format(result), acc = result, op = op, startNewEntry = true, typed = "")
            }
            else -> s.copy(acc = current, op = op, startNewEntry = true, typed = "")
        }
    }

    private fun equals(s: CalculatorState): CalculatorState {
        val current = value(s.entry)
        return when {
            s.op != null && s.acc != null -> {
                val result = apply(s.acc, s.op, current) ?: return errorState()
                s.copy(
                    entry = format(result), acc = null, op = null, startNewEntry = false, justEvaluated = true,
                    lastOp = s.op, lastOperand = current, typed = "",
                )
            }
            s.justEvaluated && s.lastOp != null && s.lastOperand != null -> {
                val result = apply(current, s.lastOp, s.lastOperand) ?: return errorState()
                s.copy(entry = format(result), typed = "")
            }
            else -> s.copy(typed = "")
        }
    }

    private fun backspace(s: CalculatorState): CalculatorState {
        if (s.justEvaluated || s.startNewEntry) return s
        val shorter = s.entry.dropLast(1)
        val newEntry = if (shorter.isEmpty() || shorter == "-") "0" else shorter
        return s.copy(entry = newEntry, typed = s.typed.dropLast(1))
    }

    private fun toggleSign(s: CalculatorState): CalculatorState {
        if (value(s.entry).signum() == 0 && '.' !in s.entry) return s
        val toggled = if (s.entry.startsWith("-")) s.entry.removePrefix("-") else "-${s.entry}"
        return s.copy(entry = toggled, startNewEntry = false, typed = "")
    }

    private fun percent(s: CalculatorState): CalculatorState {
        val current = value(s.entry)
        val result = if (s.acc != null && s.op != null) s.acc.multiply(current).divide(BigDecimal(100), MC)
        else current.divide(BigDecimal(100), MC)
        return s.copy(entry = format(result), startNewEntry = false, typed = "")
    }

    private fun errorState() = CalculatorState(error = true)

    private fun apply(a: BigDecimal, op: CalcOp, b: BigDecimal): BigDecimal? = when (op) {
        CalcOp.Add -> a.add(b)
        CalcOp.Subtract -> a.subtract(b)
        CalcOp.Multiply -> a.multiply(b)
        CalcOp.Divide -> if (b.signum() == 0) null else a.divide(b, MC)
    }.let { it?.round(MC) }

    private fun value(entry: String): BigDecimal = entry.removeSuffix(".").toBigDecimalOrNull() ?: BigDecimal.ZERO

    /** Texto de pantalla: sin ceros sobrantes y en notación científica si es demasiado largo. */
    fun format(value: BigDecimal): String {
        if (value.signum() == 0) return "0"
        val stripped = value.round(MC).stripTrailingZeros()
        val plain = stripped.toPlainString()
        return if (plain.length <= 14) plain else stripped.toString()
    }
}
