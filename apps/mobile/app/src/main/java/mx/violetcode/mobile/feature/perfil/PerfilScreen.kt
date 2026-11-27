package mx.violetcode.mobile.feature.perfil

import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardColors
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import mx.violetcode.mobile.core.designsystem.component.VioletMessageCard
import mx.violetcode.mobile.core.designsystem.component.VioletPrimaryButton
import mx.violetcode.mobile.core.designsystem.motion.fadeInOnAppear
import mx.violetcode.mobile.core.designsystem.motion.pressScale
import mx.violetcode.mobile.core.domain.account.ProfileState
import mx.violetcode.mobile.core.domain.account.UserProfile
import org.koin.androidx.compose.koinViewModel

/** Texto neutro: la cuenta nunca revela si hay o no un expediente ligado (RF-33.1). */
internal const val ACCOUNT_ACTIVE_LABEL = "Cuenta activa"

/**
 * «Mi perfil»: nombre, correo, CURP y celular enmascarados y cierre de sesión con confirmación.
 * Sin sesión no hay nada que mostrar: [onSignedOut] regresa a Inicio (también tras cerrar sesión).
 */
@Composable
fun PerfilScreen(
    onSignedOut: () -> Unit,
    viewModel: PerfilViewModel = koinViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var confirmSignOut by remember { mutableStateOf(false) }

    LaunchedEffect(state.profile) { if (state.profile is ProfileState.SignedOut) onSignedOut() }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            "Mi perfil",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.semantics { heading() }.fadeInOnAppear(index = 0),
        )

        when (val profile = state.profile) {
            ProfileState.Loading, ProfileState.SignedOut -> Box(
                Modifier.fillMaxWidth().padding(vertical = 32.dp),
                contentAlignment = Alignment.Center,
            ) { CircularProgressIndicator() }

            ProfileState.Unavailable -> {
                VioletMessageCard(
                    "No pudimos cargar tus datos. Revisa tu conexión e inténtalo de nuevo.",
                    isError = true,
                    modifier = Modifier.fadeInOnAppear(index = 1),
                )
                OutlinedButton(onClick = viewModel::retry, modifier = Modifier.fadeInOnAppear(index = 2)) { Text("Reintentar") }
            }

            is ProfileState.Ready -> {
                ProfileHeader(profile.profile, Modifier.fadeInOnAppear(index = 1))
                ProfileDetails(profile.profile, Modifier.fadeInOnAppear(index = 2))
                Text(
                    "Por tu seguridad, tu CURP y tu celular se muestran ocultos en parte.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.fadeInOnAppear(index = 3),
                )
            }
        }

        if (state.profile !is ProfileState.Loading) {
            OutlinedButton(
                onClick = { confirmSignOut = true },
                enabled = !state.signingOut,
                modifier = Modifier.fillMaxWidth().fadeInOnAppear(index = 4),
            ) { Text("Cerrar sesión") }
        }
    }

    if (confirmSignOut) {
        AlertDialog(
            onDismissRequest = { confirmSignOut = false },
            title = { Text("¿Cerrar sesión?") },
            text = { Text("Tendrás que iniciar sesión de nuevo para usar el botón de ayuda.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmSignOut = false
                    viewModel.signOut()
                }) { Text("Cerrar sesión") }
            },
            dismissButton = { TextButton(onClick = { confirmSignOut = false }) { Text("Cancelar") } },
        )
    }
}

@Composable
private fun ProfileHeader(profile: UserProfile, modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        Avatar(profile.initials, size = 72)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(profile.fullName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            AccountStatusChip()
        }
    }
}

@Composable
private fun ProfileDetails(profile: UserProfile, modifier: Modifier = Modifier) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer),
        modifier = modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            DetailRow("Correo electrónico", profile.email ?: "No disponible")
            DetailRow("CURP", profile.maskedCurp)
            profile.maskedCelular?.let { DetailRow("Celular", it) }
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Column {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyLarge)
    }
}

@Composable
private fun AccountStatusChip() {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Icon(
            Icons.Outlined.CheckCircle,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(16.dp),
        )
        Text(ACCOUNT_ACTIVE_LABEL, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
    }
}

@Composable
private fun Avatar(initials: String, size: Int) {
    Surface(
        shape = CircleShape,
        color = MaterialTheme.colorScheme.primaryContainer,
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
        modifier = Modifier.size(size.dp).semantics { contentDescription = "Iniciales $initials" },
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                initials,
                style = if (size >= 64) MaterialTheme.typography.headlineSmall else MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

@Composable
private fun PersonBadge() {
    Surface(shape = CircleShape, color = MaterialTheme.colorScheme.primaryContainer) {
        Icon(
            Icons.Outlined.Person,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onPrimaryContainer,
            modifier = Modifier.padding(10.dp).size(28.dp),
        )
    }
}

/**
 * Sección superior de Ajustes. Con sesión: tarjeta con avatar y nombre que abre «Mi perfil».
 * Sin sesión: invita a iniciar sesión o crear cuenta.
 */
@Composable
fun AccountCard(
    onOpenProfile: () -> Unit,
    onLogin: () -> Unit,
    onRegister: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: PerfilViewModel = koinViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val cardColors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer)

    when (val profile = state.profile) {
        ProfileState.Loading -> Card(colors = cardColors, modifier = modifier.fillMaxWidth()) {
            Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 2.dp)
            }
        }

        ProfileState.SignedOut -> Card(colors = cardColors, modifier = modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    PersonBadge()
                    Column {
                        Text("Mi cuenta", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text(
                            "Inicia sesión para usar el botón de ayuda.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                VioletPrimaryButton(text = "Iniciar sesión", onClick = onLogin)
                TextButton(onClick = onRegister, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("Crear cuenta") }
            }
        }

        // Con sesión pero sin poder leer el perfil: sigue siendo la misma cuenta, con acceso a «Mi perfil» (cerrar sesión).
        ProfileState.Unavailable -> AccountEntry(
            initials = null,
            title = "Mi perfil",
            subtitle = ACCOUNT_ACTIVE_LABEL,
            onClick = onOpenProfile,
            colors = cardColors,
            modifier = modifier,
        )

        is ProfileState.Ready -> AccountEntry(
            initials = profile.profile.initials,
            title = profile.profile.fullName,
            subtitle = "$ACCOUNT_ACTIVE_LABEL · Ver mi perfil",
            onClick = onOpenProfile,
            colors = cardColors,
            modifier = modifier,
        )
    }
}

@Composable
private fun AccountEntry(
    initials: String?,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
    colors: CardColors,
    modifier: Modifier = Modifier,
) {
    val source = remember { MutableInteractionSource() }
    Card(
        onClick = onClick,
        interactionSource = source,
        colors = colors,
        modifier = modifier.fillMaxWidth().pressScale(source),
    ) {
        Row(
            Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            if (initials != null) Avatar(initials, size = 48) else PersonBadge()
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, contentDescription = null)
        }
    }
}
