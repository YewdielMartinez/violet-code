package mx.violetcode.mobile.feature.directorio

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
fun DirectorioScreen(vm: DirectorioViewModel = viewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()

    when (val s = state) {
        DirectorioUiState.Loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        DirectorioUiState.Error -> Column(
            Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("No se pudo cargar el directorio.", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(12.dp))
            Button(onClick = vm::load) { Text("Reintentar") }
        }
        is DirectorioUiState.Ready -> LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(s.entries, key = { it.id }) { DirectoryCard(it) }
        }
    }
}

@Composable
private fun DirectoryCard(entry: DirectoryEntry) {
    val context = LocalContext.current
    val container = if (entry.isEmergency) MaterialTheme.colorScheme.errorContainer
    else MaterialTheme.colorScheme.surfaceContainer

    Card(colors = CardDefaults.cardColors(containerColor = container), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Text(
                if (entry.kind == "VioletPoint") "Punto Violeta" else "Instancia",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
            )
            Text(entry.name, style = MaterialTheme.typography.titleMedium)
            entry.schedule?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
            entry.address?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
            entry.phone?.let { phone ->
                Spacer(Modifier.height(8.dp))
                FilledTonalButton(onClick = {
                    context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")))
                }) {
                    Icon(Icons.Outlined.Call, contentDescription = null)
                    Text("  Llamar $phone")
                }
            }
        }
    }
}
