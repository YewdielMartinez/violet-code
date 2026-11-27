package mx.violetcode.mobile.feature.auxilio

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material.icons.outlined.NotificationsActive
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import mx.violetcode.mobile.core.designsystem.component.HoldToConfirmButton
import mx.violetcode.mobile.core.designsystem.component.VioletMessageCard
import mx.violetcode.mobile.core.designsystem.motion.fadeInOnAppear
import mx.violetcode.mobile.core.domain.account.AccountFailure
import mx.violetcode.mobile.core.domain.account.SessionState
import org.koin.androidx.compose.koinViewModel

/**
 * Auxilio. Acceso directo al 911 (marcador nativo, sin permisos) y Botón de ayuda (RF-18 / RF-18.1):
 * mantener 2 s → cuenta regresiva visible de 5 s con «Cancelar» → alerta a SEMUJERES vía RPC `enviar_alerta`.
 * Sin sesión no se envía nada: se guía a iniciar sesión ([onLogin]).
 * La confirmación es discreta: no muestra datos de la usuaria ni del caso.
 */
@Composable
fun AuxilioScreen(
    onLogin: () -> Unit = {},
    onRegister: () -> Unit = {},
    viewModel: AyudaViewModel = koinViewModel(),
) {
    val context = LocalContext.current
    val call911 = { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:911"))) }
    val ui by viewModel.state.collectAsStateWithLifecycle()
    val haptic = LocalHapticFeedback.current

    // Vibración corta en cada segundo de la cuenta regresiva y al terminar.
    val phase = ui.phase
    LaunchedEffect((phase as? AyudaPhase.Countdown)?.secondsLeft, phase is AyudaPhase.Sent) {
        if (phase is AyudaPhase.Countdown) haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        if (phase is AyudaPhase.Sent) haptic.performHapticFeedback(HapticFeedbackType.LongPress)
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fadeInOnAppear(index = 0),
        ) {
            Text(
                "¿Estás en peligro ahora?",
                style = MaterialTheme.typography.headlineMedium,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "Llama al 911. Es gratis y atiende las 24 horas.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }
        Spacer(Modifier.height(32.dp))

        // Botón grande: fácil de tocar con nervios o poca experiencia digital.
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fadeInOnAppear(index = 1),
        ) {
            HoldToConfirmButton(
                onConfirm = call911,
                contentDescription = "Llamar al 911. Mantén presionado un segundo para confirmar.",
                accessibilityActionLabel = "Llamar al 911",
                holdDurationMillis = 1000,
            ) {
                Icon(Icons.Outlined.Call, contentDescription = null, modifier = Modifier.size(48.dp))
                Text("911", style = MaterialTheme.typography.displaySmall)
            }
            Spacer(Modifier.height(16.dp))
            Text(
                "Mantén presionado para llamar al 911",
                style = MaterialTheme.typography.titleMedium,
                textAlign = TextAlign.Center,
            )
        }

        Spacer(Modifier.height(40.dp))
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxWidth().fadeInOnAppear(index = 2),
        ) {
            HelpSection(
                ui = ui,
                onStart = viewModel::startCountdown,
                onCancel = viewModel::cancel,
                onDismiss = viewModel::dismiss,
                onLogin = onLogin,
                onRegister = onRegister,
            )
        }
    }
}

@Composable
private fun HelpSection(
    ui: AyudaUiState,
    onStart: () -> Unit,
    onCancel: () -> Unit,
    onDismiss: () -> Unit,
    onLogin: () -> Unit,
    onRegister: () -> Unit,
) {
    val phase = ui.phase
    Text(
        "Botón de ayuda",
        style = MaterialTheme.typography.titleLarge,
        textAlign = TextAlign.Center,
    )
    Spacer(Modifier.height(8.dp))

    when {
        phase is AyudaPhase.Countdown -> Countdown(phase.secondsLeft, onCancel)

        phase is AyudaPhase.Sending -> {
            CircularProgressIndicator(modifier = Modifier.size(40.dp))
            Spacer(Modifier.height(12.dp))
            Text("Enviando…", style = MaterialTheme.typography.bodyLarge)
        }

        phase is AyudaPhase.Sent -> {
            // Discreto: nada de datos propios ni del caso en pantalla.
            VioletMessageCard("Listo. Tu solicitud fue enviada.")
            Spacer(Modifier.height(12.dp))
            OutlinedButton(onClick = onDismiss) { Text("Entendido") }
        }

        phase is AyudaPhase.Failed -> {
            VioletMessageCard(phase.reason.helpMessage(), isError = true)
            Spacer(Modifier.height(12.dp))
            if (phase.reason == AccountFailure.NotSignedIn) {
                Button(onClick = { onDismiss(); onLogin() }) { Text("Iniciar sesión") }
            } else {
                OutlinedButton(onClick = onDismiss) { Text("Entendido") }
            }
            Spacer(Modifier.height(8.dp))
            Text(
                "Si estás en peligro, llama al 911.",
                style = MaterialTheme.typography.bodyMedium,
                textAlign = TextAlign.Center,
            )
        }

        ui.session is SessionState.SignedIn -> {
            Text(
                "Avisa a SEMUJERES sin llamar. Mantén presionado 2 segundos; después tendrás 5 segundos para cancelar.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(16.dp))
            HoldToConfirmButton(
                onConfirm = onStart,
                contentDescription = "Botón de ayuda. Mantén presionado dos segundos para pedir ayuda a SEMUJERES.",
                accessibilityActionLabel = "Pedir ayuda a SEMUJERES",
                holdDurationMillis = AyudaViewModel.HOLD_MILLIS,
                size = 160.dp,
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ) {
                Icon(Icons.Outlined.NotificationsActive, contentDescription = null, modifier = Modifier.size(40.dp))
                Text("Ayuda", style = MaterialTheme.typography.titleLarge)
            }
        }

        ui.session is SessionState.Loading -> CircularProgressIndicator(modifier = Modifier.size(32.dp))

        else -> {
            // Sin sesión: guiar a iniciar sesión o registrarse.
            Text(
                "Para enviar una alerta a SEMUJERES necesitas iniciar sesión. Mientras tanto, puedes llamar al 911.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(16.dp))
            Button(onClick = onLogin, modifier = Modifier.fillMaxWidth()) { Text("Iniciar sesión") }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = onRegister, modifier = Modifier.fillMaxWidth()) { Text("Crear cuenta") }
        }
    }
}

/** Cuenta regresiva visible con «Cancelar» grande. La región viva anuncia el cambio a lectores de pantalla. */
@Composable
private fun Countdown(secondsLeft: Int, onCancel: () -> Unit) {
    Text(
        "Enviando ayuda en",
        style = MaterialTheme.typography.titleMedium,
        textAlign = TextAlign.Center,
    )
    Text(
        secondsLeft.toString(),
        style = MaterialTheme.typography.displayLarge,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.semantics {
            liveRegion = LiveRegionMode.Assertive
            contentDescription = "Enviando ayuda en $secondsLeft segundos. Toca cancelar para detener."
        },
    )
    Spacer(Modifier.height(16.dp))
    Button(
        onClick = onCancel,
        modifier = Modifier.fillMaxWidth().height(64.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.error,
            contentColor = MaterialTheme.colorScheme.onError,
        ),
    ) {
        Text("Cancelar", style = MaterialTheme.typography.titleLarge)
    }
}
