package mx.violetcode.mobile.feature.inicio

import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Sos
import androidx.compose.material.icons.outlined.TaskAlt
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import mx.violetcode.mobile.core.designsystem.motion.fadeInOnAppear
import mx.violetcode.mobile.core.designsystem.motion.pressScale
import java.time.LocalTime

/**
 * Inicio: saludo, tarjeta de emergencia (lleva a Auxilio) y accesos rápidos.
 * Las entradas llegan escalonadas (fade + ascenso) y las tarjetas responden con presión elástica.
 * Sin lógica de negocio: solo navega mediante los callbacks.
 */
@Composable
fun InicioScreen(
    onEmergency: () -> Unit,
    onOrientacion: () -> Unit,
    onDirectorio: () -> Unit,
    onSeguimiento: () -> Unit,
) {
    val greeting = remember { greetingForNow() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column(Modifier.fadeInOnAppear(index = 0)) {
            Text(greeting, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.SemiBold)
            Text(
                "Estamos para acompañarte. Elige lo que necesitas.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        EmergencyCard(onClick = onEmergency, modifier = Modifier.fadeInOnAppear(index = 1))

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            QuickActionCard(
                title = "Orientación",
                subtitle = "Qué hacer y a dónde ir",
                icon = Icons.AutoMirrored.Outlined.MenuBook,
                onClick = onOrientacion,
                modifier = Modifier.weight(1f).fadeInOnAppear(index = 2),
            )
            QuickActionCard(
                title = "Directorio y Puntos Violeta",
                subtitle = "Lugares cerca de ti",
                icon = Icons.Outlined.Place,
                onClick = onDirectorio,
                modifier = Modifier.weight(1f).fadeInOnAppear(index = 3),
            )
        }
        QuickActionCard(
            title = "Mi caso",
            subtitle = "Revisa el estado de tu atención",
            icon = Icons.Outlined.TaskAlt,
            onClick = onSeguimiento,
            modifier = Modifier.fillMaxWidth().fadeInOnAppear(index = 4),
        )

        QuickExitNote(Modifier.fadeInOnAppear(index = 5))
    }
}

@Composable
private fun EmergencyCard(onClick: () -> Unit, modifier: Modifier = Modifier) {
    val source = remember { MutableInteractionSource() }
    Card(
        onClick = onClick,
        interactionSource = source,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer,
            contentColor = MaterialTheme.colorScheme.onErrorContainer,
        ),
        modifier = modifier.fillMaxWidth().pressScale(source),
    ) {
        Row(
            Modifier.padding(20.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Surface(
                shape = CircleShape,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.size(64.dp),
            ) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Icon(
                        Icons.Outlined.Sos,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onError,
                        modifier = Modifier.size(36.dp),
                    )
                }
            }
            Spacer(Modifier.width(16.dp))
            Column {
                Text("¿Estás en peligro ahora?", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                Text(
                    "Toca aquí para ir a Auxilio y llamar al 911.",
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

@Composable
private fun QuickActionCard(
    title: String,
    subtitle: String,
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val source = remember { MutableInteractionSource() }
    Card(
        onClick = onClick,
        interactionSource = source,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
        modifier = modifier.pressScale(source),
    ) {
        Column(
            Modifier.padding(16.dp).heightIn(min = 112.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Surface(shape = CircleShape, color = MaterialTheme.colorScheme.primaryContainer) {
                Icon(
                    icon,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier.padding(10.dp).size(24.dp),
                )
            }
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text(
                subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** Recordatorio del botón de salida rápida (siempre visible arriba a la derecha). */
@Composable
private fun QuickExitNote(modifier: Modifier = Modifier) {
    Surface(
        color = MaterialTheme.colorScheme.secondaryContainer,
        contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
        shape = MaterialTheme.shapes.medium,
        modifier = modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.Info, contentDescription = null)
            Spacer(Modifier.width(12.dp))
            Text(
                "¿Necesitas salir de inmediato? Toca «Salir rápido», arriba a la derecha: cierra la app y la quita de recientes.",
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

private fun greetingForNow(): String = when (LocalTime.now().hour) {
    in 5..11 -> "Buenos días"
    in 12..19 -> "Buenas tardes"
    else -> "Buenas noches"
}
