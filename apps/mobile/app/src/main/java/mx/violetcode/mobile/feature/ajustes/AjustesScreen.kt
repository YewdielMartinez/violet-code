package mx.violetcode.mobile.feature.ajustes

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.heading
import androidx.compose.foundation.selection.toggleable
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.collectAsState
import mx.violetcode.mobile.core.designsystem.component.VioletMessageCard
import mx.violetcode.mobile.core.designsystem.motion.fadeInOnAppear
import mx.violetcode.mobile.core.domain.disguise.PinPolicy
import mx.violetcode.mobile.disguise.DisguiseController
import mx.violetcode.mobile.feature.perfil.AccountCard
import org.koin.compose.koinInject

/**
 * Ajustes de seguridad: modo discreto (calculadora con PIN) y salida rápida.
 * Esta pantalla solo se ve con la app desbloqueada; la calculadora nunca la muestra.
 */
@Composable
fun AjustesScreen(
    onOpenProfile: () -> Unit,
    onLogin: () -> Unit,
    onRegister: () -> Unit,
    controller: DisguiseController = koinInject(),
) {
    val enabled by controller.enabled.collectAsState()
    var dialog by remember { mutableStateOf<Dialog?>(null) }
    var neutralSite by remember { mutableStateOf(controller.neutralSiteOnExit) }
    var notice by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            "Ajustes",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.semantics { heading() }.fadeInOnAppear(index = 0),
        )

        AccountCard(
            onOpenProfile = onOpenProfile,
            onLogin = onLogin,
            onRegister = onRegister,
            modifier = Modifier.fadeInOnAppear(index = 1),
        )

        notice?.let { VioletMessageCard(it) }

        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer),
            modifier = Modifier.fillMaxWidth().fadeInOnAppear(index = 2),
        ) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                SwitchRow(
                    title = "Modo discreto",
                    subtitle = "La app se disfraza de calculadora. Para entrar, escribe tu PIN y pulsa =.",
                    checked = enabled,
                    onCheckedChange = { on -> dialog = if (on) Dialog.SetPin else Dialog.ConfirmDisable },
                )
                if (enabled) {
                    Text(
                        "Al salir de la app, el ícono y el nombre en tu teléfono cambian a «Calculadora». Se bloquea al salir de la app, " +
                            "tras 2 minutos sin usarla y con «Salir rápido». Si olvidas el PIN no hay forma de recuperarlo.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { dialog = Dialog.ChangePin }) { Text("Cambiar PIN") }
                        OutlinedButton(onClick = controller::lock) { Text("Bloquear ahora") }
                    }
                }
            }
        }

        if (!enabled) {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer),
                modifier = Modifier.fillMaxWidth().fadeInOnAppear(index = 3),
            ) {
                Column(Modifier.padding(16.dp)) {
                    SwitchRow(
                        title = "Abrir un sitio neutro al salir",
                        subtitle = "«Salir rápido» abrirá una página cualquiera en el navegador en lugar de ir al inicio. " +
                            "Puede quedar en el historial del navegador.",
                        checked = neutralSite,
                        onCheckedChange = {
                            neutralSite = it
                            controller.neutralSiteOnExit = it
                        },
                    )
                }
            }
        }
    }

    when (dialog) {
        Dialog.SetPin, Dialog.ChangePin -> PinSetupDialog(
            title = if (dialog == Dialog.SetPin) "Crea tu PIN" else "Nuevo PIN",
            onDismiss = { dialog = null },
            onConfirm = { pin ->
                val ok = if (dialog == Dialog.SetPin) controller.enable(pin) else controller.changePin(pin)
                notice = when {
                    !ok -> "No se pudo guardar el PIN."
                    dialog == Dialog.SetPin -> "Modo discreto activado. Al salir de la app, el ícono cambiará a «Calculadora»: ábrela, escribe tu PIN y pulsa =."
                    else -> "PIN actualizado."
                }
                dialog = null
            },
        )
        Dialog.ConfirmDisable -> AlertDialog(
            onDismissRequest = { dialog = null },
            title = { Text("¿Desactivar el modo discreto?") },
            text = { Text("La app volverá a verse con su nombre e ícono normales y se borrará el PIN.") },
            confirmButton = {
                TextButton(onClick = {
                    controller.disable()
                    notice = "Modo discreto desactivado. Al salir de la app volverá su ícono normal."
                    dialog = null
                }) { Text("Desactivar") }
            },
            dismissButton = { TextButton(onClick = { dialog = null }) { Text("Cancelar") } },
        )
        null -> Unit
    }
}

private enum class Dialog { SetPin, ChangePin, ConfirmDisable }

@Composable
private fun SwitchRow(title: String, subtitle: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        Modifier.fillMaxWidth().toggleable(value = checked, role = Role.Switch, onValueChange = onCheckedChange),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(checked = checked, onCheckedChange = null)
    }
}

@Composable
private fun PinSetupDialog(title: String, onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    var pin by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    val formatOk = PinPolicy.isValidFormat(pin)
    val matches = pin == confirm
    val error = when {
        pin.isNotEmpty() && !formatOk -> "El PIN debe tener de ${PinPolicy.MIN_LENGTH} a ${PinPolicy.MAX_LENGTH} dígitos."
        confirm.isNotEmpty() && !matches -> "Los PIN no coinciden."
        else -> null
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "De ${PinPolicy.MIN_LENGTH} a ${PinPolicy.MAX_LENGTH} dígitos. Memorízalo: no se puede recuperar.",
                    style = MaterialTheme.typography.bodyMedium,
                )
                PinField("PIN", pin) { pin = it }
                PinField("Confirma el PIN", confirm) { confirm = it }
                if (error != null) {
                    Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
                Spacer(Modifier.height(2.dp))
            }
        },
        confirmButton = {
            Button(onClick = { onConfirm(pin) }, enabled = formatOk && matches) { Text("Guardar") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
    )
}

@Composable
private fun PinField(label: String, value: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = { new -> onChange(new.filter(Char::isDigit).take(PinPolicy.MAX_LENGTH)) },
        label = { Text(label) },
        singleLine = true,
        visualTransformation = PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
        modifier = Modifier.fillMaxWidth(),
    )
}
