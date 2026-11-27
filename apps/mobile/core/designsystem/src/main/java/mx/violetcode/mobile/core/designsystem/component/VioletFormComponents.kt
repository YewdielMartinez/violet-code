package mx.violetcode.mobile.core.designsystem.component

import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import mx.violetcode.mobile.core.designsystem.motion.pressScale

/**
 * Campo de texto de formularios. Muestra [error] debajo (en lugar de [supportingText]) y avisa del error
 * a los lectores de pantalla.
 */
@Composable
fun VioletTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    error: String? = null,
    supportingText: String? = null,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    trailingIcon: @Composable (() -> Unit)? = null,
    enabled: Boolean = true,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        modifier = modifier.fillMaxWidth(),
        enabled = enabled,
        singleLine = true,
        isError = error != null,
        supportingText = (error ?: supportingText)?.let { text -> { Text(text) } },
        keyboardOptions = keyboardOptions,
        keyboardActions = keyboardActions,
        visualTransformation = visualTransformation,
        trailingIcon = trailingIcon,
        shape = MaterialTheme.shapes.small,
    )
}

/** Campo de contraseña con botón de mostrar/ocultar (con etiqueta para TalkBack). */
@Composable
fun VioletPasswordField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    error: String? = null,
    supportingText: String? = null,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    enabled: Boolean = true,
) {
    var visible by remember { mutableStateOf(false) }
    VioletTextField(
        value = value,
        onValueChange = onValueChange,
        label = label,
        modifier = modifier,
        error = error,
        supportingText = supportingText,
        keyboardOptions = keyboardOptions,
        keyboardActions = keyboardActions,
        enabled = enabled,
        visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(),
        trailingIcon = {
            IconButton(onClick = { visible = !visible }) {
                Icon(
                    imageVector = if (visible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                    contentDescription = if (visible) "Ocultar contraseña" else "Mostrar contraseña",
                )
            }
        },
    )
}

/** Botón principal de formularios: ancho completo, presión elástica y estado de carga. */
@Composable
fun VioletPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
) {
    val source = remember { MutableInteractionSource() }
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        interactionSource = source,
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 52.dp)
            .pressScale(source),
        colors = ButtonDefaults.buttonColors(),
    ) {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                strokeWidth = 2.dp,
                color = MaterialTheme.colorScheme.onPrimary,
            )
        } else {
            Text(text, style = MaterialTheme.typography.titleMedium)
        }
    }
}

/** Casilla con texto clicable en toda la fila (área táctil amplia) y semántica de casilla. */
@Composable
fun VioletCheckboxRow(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    error: String? = null,
    content: @Composable () -> Unit,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .toggleable(value = checked, role = Role.Checkbox, onValueChange = onCheckedChange)
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Checkbox(checked = checked, onCheckedChange = null)
        Row(modifier = Modifier.weight(1f)) { content() }
    }
    if (error != null) {
        Text(
            error,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(start = 16.dp),
        )
    }
}

/** Mensaje en tarjeta (error o información). Se anuncia solo a lectores de pantalla (región viva). */
@Composable
fun VioletMessageCard(text: String, modifier: Modifier = Modifier, isError: Boolean = false) {
    val container = if (isError) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.secondaryContainer
    val content = if (isError) MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.onSecondaryContainer
    Surface(
        color = container,
        contentColor = content,
        shape = MaterialTheme.shapes.small,
        modifier = modifier
            .fillMaxWidth()
            .semantics { liveRegion = LiveRegionMode.Polite },
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Icon(
                imageVector = if (isError) Icons.Outlined.ErrorOutline else Icons.Outlined.Info,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
            )
            Text(text, style = MaterialTheme.typography.bodyMedium)
        }
    }
}
