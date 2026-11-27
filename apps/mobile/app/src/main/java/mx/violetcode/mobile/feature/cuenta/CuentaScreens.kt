package mx.violetcode.mobile.feature.cuenta

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import mx.violetcode.mobile.R
import mx.violetcode.mobile.core.designsystem.component.VioletCheckboxRow
import mx.violetcode.mobile.core.designsystem.component.VioletMessageCard
import mx.violetcode.mobile.core.designsystem.component.VioletPasswordField
import mx.violetcode.mobile.core.designsystem.component.VioletPrimaryButton
import mx.violetcode.mobile.core.designsystem.component.VioletTextField
import mx.violetcode.mobile.core.designsystem.motion.fadeInOnAppear
import mx.violetcode.mobile.core.domain.account.AccountFailure
import mx.violetcode.mobile.core.domain.account.SignUpOutcome
import mx.violetcode.mobile.core.domain.validation.RegistrationValidator
import org.koin.androidx.compose.koinViewModel

/** Inicio de sesión (correo + contraseña). Mensajes genéricos: nunca dicen si el correo existe (RF-33.1). */
@Composable
fun LoginScreen(
    onSignedIn: () -> Unit,
    onRegister: () -> Unit,
    viewModel: LoginViewModel = koinViewModel(),
) {
    val s by viewModel.state.collectAsStateWithLifecycle()
    val focus = LocalFocusManager.current
    LaunchedEffect(s.signedIn) { if (s.signedIn) onSignedIn() }

    FormScaffold(title = "Iniciar sesión", subtitle = "Entra para usar el botón de ayuda y dar seguimiento a tu caso.") {
        s.failure?.let { VioletMessageCard(it.loginMessage(), isError = true) }
        VioletTextField(
            value = s.email,
            onValueChange = viewModel::onEmailChange,
            label = "Correo electrónico",
            error = if (s.emailError) "Escribe un correo válido" else null,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
            keyboardActions = KeyboardActions(onNext = { focus.moveFocus(androidx.compose.ui.focus.FocusDirection.Down) }),
            enabled = !s.loading,
        )
        VioletPasswordField(
            value = s.password,
            onValueChange = viewModel::onPasswordChange,
            label = "Contraseña",
            error = if (s.passwordError) "Escribe tu contraseña" else null,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { focus.clearFocus(); viewModel.submit() }),
            enabled = !s.loading,
        )
        VioletPrimaryButton(text = "Iniciar sesión", onClick = viewModel::submit, loading = s.loading)
        TextButton(onClick = onRegister, modifier = Modifier.align(Alignment.CenterHorizontally)) {
            Text("¿No tienes cuenta? Regístrate")
        }
    }
}

/**
 * Registro (RF-33). Tras enviar, siempre se muestra el mismo mensaje «revisa tu correo»: no se revela si el
 * correo o la CURP ya existen ni si hay un expediente ligado (RF-33.1).
 */
@Composable
fun RegistroScreen(
    onSignedIn: () -> Unit,
    onGoLogin: () -> Unit,
    viewModel: RegistroViewModel = koinViewModel(),
) {
    val s by viewModel.state.collectAsStateWithLifecycle()
    val focus = LocalFocusManager.current
    var showAviso by remember { mutableStateOf(false) }
    LaunchedEffect(s.outcome) { if (s.outcome == SignUpOutcome.SignedIn) onSignedIn() }

    if (s.outcome == SignUpOutcome.CheckEmail) {
        FormScaffold(title = "Revisa tu correo", subtitle = null) {
            VioletMessageCard(
                "Si los datos son correctos, te enviamos un mensaje para confirmar tu cuenta. " +
                    "Confírmala desde tu correo y después inicia sesión.",
            )
            VioletPrimaryButton(text = "Ir a iniciar sesión", onClick = onGoLogin)
        }
        return
    }

    val next = KeyboardActions(onNext = { focus.moveFocus(androidx.compose.ui.focus.FocusDirection.Down) })
    FormScaffold(title = "Crear cuenta", subtitle = "Tus datos se usan solo para brindarte atención de SEMUJERES.") {
        s.failure?.let { VioletMessageCard(it.registerMessage(), isError = true) }
        VioletTextField(
            value = s.curp,
            onValueChange = viewModel::onCurp,
            label = "CURP",
            error = if (s.curpError) "Revisa tu CURP: son 18 caracteres" else null,
            keyboardOptions = KeyboardOptions(
                capitalization = KeyboardCapitalization.Characters,
                keyboardType = KeyboardType.Ascii,
                imeAction = ImeAction.Next,
            ),
            keyboardActions = next,
            enabled = !s.loading,
        )
        VioletTextField(
            value = s.nombres,
            onValueChange = viewModel::onNombres,
            label = "Nombre(s)",
            error = if (s.nombresError) "Escribe tu nombre" else null,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words, imeAction = ImeAction.Next),
            keyboardActions = next,
            enabled = !s.loading,
        )
        VioletTextField(
            value = s.apellidoPaterno,
            onValueChange = viewModel::onPaterno,
            label = "Apellido paterno",
            error = if (s.paternoError) "Escribe tu apellido paterno" else null,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words, imeAction = ImeAction.Next),
            keyboardActions = next,
            enabled = !s.loading,
        )
        VioletTextField(
            value = s.apellidoMaterno,
            onValueChange = viewModel::onMaterno,
            label = "Apellido materno (opcional)",
            error = if (s.maternoError) "Texto no válido" else null,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words, imeAction = ImeAction.Next),
            keyboardActions = next,
            enabled = !s.loading,
        )
        VioletTextField(
            value = s.celular,
            onValueChange = viewModel::onCelular,
            label = "Celular (opcional)",
            error = if (s.celularError) "Son 10 dígitos" else null,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone, imeAction = ImeAction.Next),
            keyboardActions = next,
            enabled = !s.loading,
        )
        VioletTextField(
            value = s.email,
            onValueChange = viewModel::onEmail,
            label = "Correo electrónico",
            error = if (s.emailError) "Escribe un correo válido" else null,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
            keyboardActions = next,
            enabled = !s.loading,
        )
        VioletPasswordField(
            value = s.password,
            onValueChange = viewModel::onPassword,
            label = "Contraseña",
            supportingText = "Mínimo ${RegistrationValidator.MIN_PASSWORD_LENGTH} caracteres",
            error = if (s.passwordError) "Mínimo ${RegistrationValidator.MIN_PASSWORD_LENGTH} caracteres" else null,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { focus.clearFocus() }),
            enabled = !s.loading,
        )
        VioletCheckboxRow(
            checked = s.avisoAceptado,
            onCheckedChange = viewModel::onAviso,
            error = if (s.avisoError) "Debes aceptar el aviso de privacidad" else null,
        ) {
            Column {
                Text("Acepto el aviso de privacidad", style = MaterialTheme.typography.bodyLarge)
                TextButton(onClick = { showAviso = true }) { Text("Leer aviso") }
            }
        }
        VioletPrimaryButton(text = "Crear cuenta", onClick = viewModel::submit, loading = s.loading)
        TextButton(onClick = onGoLogin, modifier = Modifier.align(Alignment.CenterHorizontally)) {
            Text("¿Ya tienes cuenta? Inicia sesión")
        }
    }

    if (showAviso) {
        AlertDialog(
            onDismissRequest = { showAviso = false },
            confirmButton = { TextButton(onClick = { showAviso = false }) { Text("Cerrar") } },
            title = { Text("Aviso de privacidad") },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text("Versión simplificada (borrador pendiente de validación jurídica).", style = MaterialTheme.typography.labelLarge)
                    Text(
                        "Tus datos personales se usan exclusivamente para brindarte atención, orientación y seguimiento " +
                            "de la Secretaría de las Mujeres, y para generar estadísticas que no permiten identificarte.",
                    )
                    Text(
                        "El acceso está restringido al personal autorizado, cada consulta queda registrada y la " +
                            "información se transmite cifrada.",
                    )
                }
            },
        )
    }
}

@Composable
private fun FormScaffold(
    title: String,
    subtitle: String?,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(
            modifier = Modifier.fadeInOnAppear(index = 0),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Logo del kit de assets oficial (mobile-app-assets-kit/in-app-logos).
            Image(
                painter = painterResource(R.drawable.logo_app_icon),
                contentDescription = null,
                modifier = Modifier.size(48.dp),
            )
            Text(title, style = MaterialTheme.typography.headlineMedium)
        }
        if (subtitle != null) {
            Text(
                subtitle,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.fadeInOnAppear(index = 1),
            )
        }
        Spacer(Modifier.height(4.dp))
        Column(
            modifier = Modifier.fadeInOnAppear(index = 2),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            content = content,
        )
    }
}

private fun AccountFailure.loginMessage(): String = when (this) {
    AccountFailure.Network -> "Sin conexión. Inténtalo de nuevo."
    AccountFailure.TooManyRequests -> "Demasiados intentos. Espera unos minutos."
    AccountFailure.EmailNotConfirmed -> "Confirma tu correo desde el mensaje que te enviamos y vuelve a intentar."
    else -> "Correo o contraseña incorrectos."
}

private fun AccountFailure.registerMessage(): String = when (this) {
    AccountFailure.Network -> "Sin conexión. Inténtalo de nuevo."
    AccountFailure.TooManyRequests -> "Demasiados intentos. Espera unos minutos."
    AccountFailure.InvalidData -> "Revisa los datos e inténtalo de nuevo."
    else -> "No se pudo completar el registro. Inténtalo más tarde."
}
