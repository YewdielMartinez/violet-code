package mx.violetcode.mobile.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Sos
import androidx.compose.material.icons.outlined.TaskAlt
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import mx.violetcode.mobile.feature.auxilio.AuxilioScreen
import mx.violetcode.mobile.feature.directorio.DirectorioScreen
import mx.violetcode.mobile.feature.orientacion.OrientacionScreen
import mx.violetcode.mobile.feature.seguimiento.SeguimientoScreen

private enum class Destination(val route: String, val label: String, val icon: ImageVector) {
    Auxilio("auxilio", "Auxilio", Icons.Outlined.Sos),
    Orientacion("orientacion", "Orientación", Icons.AutoMirrored.Outlined.MenuBook),
    Directorio("directorio", "Directorio", Icons.Outlined.Place),
    Seguimiento("seguimiento", "Mi caso", Icons.Outlined.TaskAlt),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VioletApp(onQuickExit: () -> Unit) {
    val nav = rememberNavController()
    val current by nav.currentBackStackEntryAsState()

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("Violet Code") },
                actions = {
                    // Salida rápida siempre visible (requisito de seguridad de la usuaria).
                    TextButton(onClick = onQuickExit) {
                        Icon(Icons.Outlined.Close, contentDescription = null)
                        Text("Salir rápido")
                    }
                },
            )
        },
        bottomBar = {
            NavigationBar {
                Destination.entries.forEach { dest ->
                    NavigationBarItem(
                        selected = current?.destination?.route == dest.route,
                        onClick = {
                            nav.navigate(dest.route) {
                                popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(dest.icon, contentDescription = null) },
                        label = { Text(dest.label) },
                    )
                }
            }
        },
    ) { padding ->
        NavHost(nav, startDestination = Destination.Auxilio.route, modifier = Modifier.padding(padding)) {
            composable(Destination.Auxilio.route) { AuxilioScreen() }
            composable(Destination.Orientacion.route) { OrientacionScreen() }
            composable(Destination.Directorio.route) { DirectorioScreen() }
            composable(Destination.Seguimiento.route) { SeguimientoScreen() }
        }
    }
}
