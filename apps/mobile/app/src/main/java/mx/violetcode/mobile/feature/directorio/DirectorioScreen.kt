package mx.violetcode.mobile.feature.directorio

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import mx.violetcode.mobile.core.designsystem.motion.fadeInOnAppear
import mx.violetcode.mobile.core.designsystem.motion.pressScale
import mx.violetcode.mobile.core.domain.AppError
import mx.violetcode.mobile.core.domain.model.DirectoryEntry
import mx.violetcode.mobile.core.domain.model.EntryKind
import org.koin.androidx.compose.koinViewModel

@Composable
fun DirectorioScreen(vm: DirectorioViewModel = koinViewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    DirectorioContent(state = state, onRetry = vm::refresh)
}

/** Sin estado propio ni ViewModel: se puede previsualizar y probar con cualquier DirectorioUiState. */
@Composable
internal fun DirectorioContent(state: DirectorioUiState, onRetry: () -> Unit) {
    when {
        state.showFullError -> FullError(state.lastError, onRetry)
        state.entries.isEmpty() && state.isRefreshing -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        state.entries.isEmpty() -> Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
            Text("Aún no hay lugares en el directorio.", style = MaterialTheme.typography.bodyLarge)
        }
        else -> LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (state.lastError != null) {
                item(key = "offline") { OfflineBanner(onRetry) }
            }
            itemsIndexed(state.entries, key = { _, entry -> entry.id }) { index, entry ->
                DirectoryCard(entry, index)
            }
        }
    }
}

@Composable
private fun FullError(error: AppError?, onRetry: () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(error.toMessage(), style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(12.dp))
        Button(onClick = onRetry) { Text("Reintentar") }
    }
}

@Composable
private fun OfflineBanner(onRetry: () -> Unit) {
    Surface(color = MaterialTheme.colorScheme.secondaryContainer, shape = MaterialTheme.shapes.medium) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Outlined.CloudOff, contentDescription = null)
            Spacer(Modifier.width(12.dp))
            Text(
                "Sin conexión. Mostrando información guardada.",
                Modifier.weight(1f),
                style = MaterialTheme.typography.bodyMedium,
            )
            TextButton(onClick = onRetry) { Text("Actualizar") }
        }
    }
}

@Composable
private fun DirectoryCard(entry: DirectoryEntry, index: Int) {
    val context = LocalContext.current
    val container = if (entry.isEmergency) MaterialTheme.colorScheme.errorContainer
    else MaterialTheme.colorScheme.surfaceContainer

    Card(
        colors = CardDefaults.cardColors(containerColor = container),
        modifier = Modifier.fillMaxWidth().fadeInOnAppear(index = index),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(
                if (entry.kind == EntryKind.VioletPoint) "Punto Violeta" else "Instancia",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
            )
            Text(entry.name, style = MaterialTheme.typography.titleMedium)
            entry.schedule?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
            entry.address?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
            entry.phone?.let { phone ->
                Spacer(Modifier.height(8.dp))
                val callSource = remember { MutableInteractionSource() }
                FilledTonalButton(
                    onClick = { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone"))) },
                    interactionSource = callSource,
                    modifier = Modifier.pressScale(callSource),
                ) {
                    Icon(Icons.Outlined.Call, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Llamar $phone")
                }
            }
        }
    }
}

private fun AppError?.toMessage(): String = when (this) {
    AppError.Network -> "Sin conexión. Conéctate a internet para descargar el directorio."
    AppError.Unauthorized -> "Tu sesión expiró."
    is AppError.Server -> "El servicio no está disponible. Intenta más tarde."
    AppError.Unexpected, null -> "No se pudo cargar el directorio."
}
