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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import mx.violetcode.mobile.core.designsystem.component.HoldToConfirmButton
import mx.violetcode.mobile.core.designsystem.motion.fadeInOnAppear

/**
 * Auxilio. Base: acceso directo al 911 (marcador nativo, sin permisos).
 * Se confirma manteniendo presionado ~1 s (evita llamadas accidentales); con lector de pantalla
 * basta el doble toque (ver [HoldToConfirmButton]).
 * Pendiente (D-01): alerta silenciosa a SEMUJERES con ubicación → módulo Alerts de Core.
 * La alerta debe pedir confirmación (mantener/deslizar) para evitar falsas alarmas.
 */
@Composable
fun AuxilioScreen() {
    val context = LocalContext.current
    val call911 = { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:911"))) }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
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

        Spacer(Modifier.height(32.dp))
        OutlinedButton(
            onClick = { /* TODO D-01: alerta silenciosa */ },
            enabled = false,
            modifier = Modifier.fillMaxWidth().fadeInOnAppear(index = 2),
        ) {
            Text("Alerta silenciosa a SEMUJERES (próximamente)")
        }
    }
}
