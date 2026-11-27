package mx.violetcode.mobile.feature.orientacion

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Sos
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import mx.violetcode.mobile.core.designsystem.motion.fadeInOnAppear
import mx.violetcode.mobile.core.designsystem.motion.pressScale
import mx.violetcode.mobile.core.domain.model.DirectoryEntry
import mx.violetcode.mobile.core.domain.violentometro.Violentometro
import mx.violetcode.mobile.core.domain.violentometro.ViolentometroItem
import mx.violetcode.mobile.core.domain.violentometro.ViolentometroSelection
import mx.violetcode.mobile.core.domain.violentometro.ViolentometroZone
import org.koin.androidx.compose.koinViewModel

/**
 * Orientación: Violentómetro interactivo (RF-26 / RF-26.1). Solo orientativo: lo marcado no se guarda ni se envía.
 * [onHelp] lleva al Botón de Ayuda (pestaña Auxilio).
 */
@Composable
fun OrientacionScreen(onHelp: () -> Unit, vm: OrientacionViewModel = koinViewModel()) {
    val selection by vm.selection.collectAsStateWithLifecycle()
    val hotline by vm.hotline.collectAsStateWithLifecycle()
    ViolentometroContent(
        selection = selection,
        hotline = hotline,
        onToggle = vm::toggle,
        onLevel = vm::setLevel,
        onClear = vm::clear,
        onHelp = onHelp,
    )
}

@Composable
internal fun ViolentometroContent(
    selection: ViolentometroSelection,
    hotline: DirectoryEntry?,
    onToggle: (ViolentometroItem) -> Unit,
    onLevel: (Int) -> Unit,
    onClear: () -> Unit,
    onHelp: () -> Unit,
) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(key = "header") { Header(Modifier.fadeInOnAppear(index = 0)) }
        item(key = "scale") {
            ScaleCard(selection, onLevel, onClear, Modifier.fadeInOnAppear(index = 1))
        }
        selection.zone?.let { zone ->
            item(key = "message") {
                ZoneMessage(zone = zone, level = selection.level ?: 0, hotline = hotline, onHelp = onHelp)
            }
        }
        ViolentometroZone.entries.forEach { zone ->
            item(key = "zone-${zone.name}") { ZoneHeader(zone, Modifier.padding(top = 8.dp)) }
            items(Violentometro.itemsIn(zone), key = { "item-${it.from}" }) { item ->
                ItemRow(item, checked = selection.isSelected(item), onCheckedChange = { onToggle(item) })
            }
        }
        item(key = "footer") {
            Text(
                "Esta escala es solo orientativa y no sustituye la valoración de una profesional. " +
                    "Nada de lo que marques se guarda ni se envía.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}

@Composable
private fun Header(modifier: Modifier = Modifier) {
    Column(modifier) {
        Text(
            Violentometro.TITLE,
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            Violentometro.TAGLINE,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.primary,
        )
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.Top) {
            Icon(Icons.Outlined.Info, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.width(8.dp))
            Text(
                "Toca las conductas que has vivido o desliza el marcador por la escala del 0 al 30. " +
                    "Solo es una guía: no se guarda nada.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

private val ThumbSize = 28.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ScaleCard(
    selection: ViolentometroSelection,
    onLevel: (Int) -> Unit,
    onClear: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val level = selection.level
    val brush = remember { violentometroBrush() }
    val description = if (level == null) "Sin marcar. Desliza para elegir un nivel del 0 al 30." else {
        val zone = Violentometro.zoneFor(level)
        "Nivel $level de 30. ${zone.headline}"
    }
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer),
        modifier = modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (level == null) "Tu marcador" else "Nivel $level de 30",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                if (level != null) TextButton(onClick = onClear) { Text("Limpiar") }
            }
            Box(Modifier.fillMaxWidth().height(48.dp), contentAlignment = Alignment.Center) {
                // Barra con el degradado; se mete media perilla a cada lado para que el centro de la perilla caiga en 0 y 30.
                Box(
                    Modifier
                        .padding(horizontal = ThumbSize / 2)
                        .fillMaxWidth()
                        .height(20.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(brush),
                )
                Slider(
                    value = (level ?: 0).toFloat(),
                    onValueChange = { onLevel(it.toInt()) },
                    valueRange = Violentometro.MIN_LEVEL.toFloat()..Violentometro.MAX_LEVEL.toFloat(),
                    steps = Violentometro.MAX_LEVEL - 1,
                    colors = SliderDefaults.colors(
                        activeTrackColor = Color.Transparent,
                        inactiveTrackColor = Color.Transparent,
                        activeTickColor = Color.Transparent,
                        inactiveTickColor = Color.Transparent,
                    ),
                    thumb = {
                        Box(
                            Modifier
                                .size(ThumbSize)
                                .alpha(if (level == null) 0.6f else 1f)
                                .background(Color.White, CircleShape)
                                .border(BorderStroke(3.dp, Color.Black), CircleShape),
                        )
                    },
                    track = {},
                    modifier = Modifier.fillMaxWidth().semantics {
                        contentDescription = "Marcador del violentómetro"
                        stateDescription = description
                    },
                )
            }
            Row(Modifier.fillMaxWidth().padding(horizontal = ThumbSize / 2 - 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                listOf(0, 10, 20, 30).forEach {
                    Text(
                        "$it",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.semantics { contentDescription = "Nivel $it" },
                    )
                }
            }
        }
    }
}

@Composable
private fun ZoneMessage(zone: ViolentometroZone, level: Int, hotline: DirectoryEntry?, onHelp: () -> Unit) {
    val context = LocalContext.current
    fun dial(phone: String) = context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")))

    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
        modifier = Modifier
            .fillMaxWidth()
            // Anuncia el cambio de zona a TalkBack sin interrumpir.
            .semantics { liveRegion = LiveRegionMode.Polite },
    ) {
        Row(Modifier.height(IntrinsicSize.Min)) {
            Box(
                Modifier
                    .width(8.dp)
                    .fillMaxHeight()
                    .background(violentometroZoneAccent(zone)),
            )
            Column(Modifier.padding(16.dp)) {
                Text(zone.headline, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(
                    "Nivel $level de 30",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(6.dp))
                Text(zone.advice, style = MaterialTheme.typography.bodyMedium)

                if (zone.isHighRisk) {
                    Spacer(Modifier.height(12.dp))
                    val helpSource = remember { MutableInteractionSource() }
                    Button(
                        onClick = onHelp,
                        interactionSource = helpSource,
                        modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp).pressScale(helpSource),
                    ) {
                        Icon(Icons.Outlined.Sos, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text("Ir al Botón de Ayuda")
                    }
                    hotline?.phone?.let { phone ->
                        Spacer(Modifier.height(8.dp))
                        val callSource = remember { MutableInteractionSource() }
                        OutlinedButton(
                            onClick = { dial(phone) },
                            interactionSource = callSource,
                            modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp).pressScale(callSource),
                        ) {
                            Icon(Icons.Outlined.Call, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text("Llamar a ${hotline.name} ($phone)", textAlign = TextAlign.Start)
                        }
                    }
                    if (zone == ViolentometroZone.Help) {
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "Si estás en peligro ahora, llama al 911.",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ZoneHeader(zone: ViolentometroZone, modifier: Modifier = Modifier) {
    val brush = remember(zone) { violentometroZoneBrush(zone) }
    Column(modifier.fillMaxWidth()) {
        Text(
            zone.headline,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            "Niveles ${zone.levels.first} a ${zone.levels.last}",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(6.dp))
        Box(Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)).background(brush))
    }
}

@Composable
private fun ItemRow(item: ViolentometroItem, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    val levelColor = remember(item) { violentometroLevelColor(item.level) }
    val container = if (checked) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surfaceContainerLow
    val description = buildString {
        append("Nivel ${item.levelText}: ${item.label}")
        item.details?.let { append(". $it") }
    }
    Surface(
        color = container,
        shape = MaterialTheme.shapes.medium,
        modifier = Modifier
            .fillMaxWidth()
            .toggleable(value = checked, role = Role.Checkbox, onValueChange = onCheckedChange)
            .semantics(mergeDescendants = true) {
                contentDescription = description
                stateDescription = if (checked) "Marcada" else "No marcada"
            },
    ) {
        Row(
            Modifier.heightIn(min = 56.dp).padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            LevelBadge(item.levelText, levelColor)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(item.label, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                item.details?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Checkbox(checked = checked, onCheckedChange = null)
        }
    }
}

/** Número del nivel sobre su color; el texto es blanco o negro según el que dé mayor contraste (≥4.5:1). */
@Composable
private fun LevelBadge(text: String, color: Color) {
    Box(
        Modifier
            .widthIn(min = 44.dp)
            .height(36.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(color)
            .padding(horizontal = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, color = violentometroOnColor(color), style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
    }
}
