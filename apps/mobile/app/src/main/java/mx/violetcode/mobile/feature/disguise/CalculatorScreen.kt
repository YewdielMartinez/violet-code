package mx.violetcode.mobile.feature.disguise

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import mx.violetcode.mobile.core.domain.disguise.CalcKey
import mx.violetcode.mobile.core.domain.disguise.CalcOp
import mx.violetcode.mobile.core.domain.disguise.CalculatorEngine
import mx.violetcode.mobile.core.domain.disguise.CalculatorState
import mx.violetcode.mobile.core.domain.disguise.PinCheck

// Paleta neutra a propósito: ni el morado de Violet Code, ni su tipografía, ni textos propios.
private val CalcBackground = Color(0xFF1B1D1F)
private val CalcDigitKey = Color(0xFF2B2E31)
private val CalcFunctionKey = Color(0xFF3A3F44)
private val CalcOperatorKey = Color(0xFF3F6B8F)
private val CalcEqualsKey = Color(0xFFB5560E)
private val CalcOnKey = Color(0xFFFFFFFF)
private val CalcSecondaryText = Color(0xFFB8BEC4)

/**
 * Calculadora básica totalmente funcional. Es la pantalla por defecto cuando el modo discreto está activo.
 * Al pulsar «=» con 4–6 dígitos sueltos, se comprueba en segundo plano si son el PIN; si lo son, [onUnlockRequest]
 * devuelve `Correct` y quien la aloja cambia a la app. Si no, «=» se comporta como en cualquier calculadora
 * (muestra el número): no hay mensajes, vibración ni cambio visual que delate la comprobación.
 */
@Composable
fun CalculatorScreen(onUnlockRequest: (String) -> PinCheck, modifier: Modifier = Modifier) {
    var state by remember { mutableStateOf(CalculatorState()) }
    val scope = rememberCoroutineScope()

    fun press(key: CalcKey) {
        val candidate = if (key == CalcKey.Equals) state.pinCandidate else null
        state = CalculatorEngine.reduce(state, key)
        if (candidate != null) {
            scope.launch {
                // PBKDF2 es costoso a propósito: fuera del hilo principal.
                val result = withContext(Dispatchers.Default) { onUnlockRequest(candidate) }
                if (result == PinCheck.Correct) state = CalculatorState()
            }
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(CalcBackground)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        Display(state, Modifier.weight(1f))
        Keypad(onKey = ::press)
    }
}

@Composable
private fun Display(state: CalculatorState, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.End,
        verticalArrangement = Arrangement.Bottom,
    ) {
        Text(
            text = state.history,
            color = CalcSecondaryText,
            fontSize = 22.sp,
            fontFamily = FontFamily.Default,
            maxLines = 1,
            textAlign = TextAlign.End,
            modifier = Modifier.fillMaxWidth(),
        )
        val shown = state.display
        Text(
            text = shown,
            color = CalcOnKey,
            // La cifra se achica al crecer para que siempre quepa en una línea.
            fontSize = when {
                shown.length <= 7 -> 72.sp
                shown.length <= 9 -> 56.sp
                shown.length <= 12 -> 44.sp
                else -> 34.sp
            },
            fontWeight = FontWeight.Light,
            fontFamily = FontFamily.Default,
            maxLines = 1,
            overflow = TextOverflow.Clip,
            textAlign = TextAlign.End,
            modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Resultado $shown" },
        )
    }
}

private data class KeySpec(val label: String, val description: String, val key: CalcKey, val kind: KeyKind)

private enum class KeyKind { Digit, Function, Operator, Equals }

private val KeyRows: List<List<KeySpec>> = listOf(
    listOf(
        KeySpec("C", "Borrar todo", CalcKey.Clear, KeyKind.Function),
        KeySpec("⌫", "Borrar un dígito", CalcKey.Backspace, KeyKind.Function),
        KeySpec("%", "Porcentaje", CalcKey.Percent, KeyKind.Function),
        KeySpec(CalcOp.Divide.symbol, "Dividido entre", CalcKey.Operator(CalcOp.Divide), KeyKind.Operator),
    ),
    listOf(digit(7), digit(8), digit(9), KeySpec(CalcOp.Multiply.symbol, "Por", CalcKey.Operator(CalcOp.Multiply), KeyKind.Operator)),
    listOf(digit(4), digit(5), digit(6), KeySpec(CalcOp.Subtract.symbol, "Menos", CalcKey.Operator(CalcOp.Subtract), KeyKind.Operator)),
    listOf(digit(1), digit(2), digit(3), KeySpec(CalcOp.Add.symbol, "Más", CalcKey.Operator(CalcOp.Add), KeyKind.Operator)),
    listOf(
        KeySpec("±", "Cambiar signo", CalcKey.ToggleSign, KeyKind.Digit),
        digit(0),
        KeySpec(".", "Punto decimal", CalcKey.Decimal, KeyKind.Digit),
        KeySpec("=", "Igual", CalcKey.Equals, KeyKind.Equals),
    ),
)

private fun digit(d: Int) = KeySpec("$d", "$d", CalcKey.Digit(d), KeyKind.Digit)

@Composable
private fun Keypad(onKey: (CalcKey) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        KeyRows.forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                row.forEach { spec -> CalcButton(spec, onClick = { onKey(spec.key) }, modifier = Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun CalcButton(spec: KeySpec, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val container = when (spec.kind) {
        KeyKind.Digit -> CalcDigitKey
        KeyKind.Function -> CalcFunctionKey
        KeyKind.Operator -> CalcOperatorKey
        KeyKind.Equals -> CalcEqualsKey
    }
    Box(
        modifier = modifier
            .heightIn(min = 76.dp)
            .clip(RoundedCornerShape(24.dp))
            .background(container)
            .clickable(role = Role.Button, onClick = onClick)
            .semantics { contentDescription = spec.description },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = spec.label,
            color = CalcOnKey,
            fontSize = 28.sp,
            fontFamily = FontFamily.Default,
            fontWeight = FontWeight.Normal,
        )
    }
}

