package mx.violetcode.mobile.ui

import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Sos
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Sos
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import mx.violetcode.mobile.core.designsystem.component.ThemeModeSwitch
import mx.violetcode.mobile.core.designsystem.motion.VioletEasing
import mx.violetcode.mobile.core.designsystem.motion.VioletMotion
import mx.violetcode.mobile.core.designsystem.motion.pressScale
import mx.violetcode.mobile.core.designsystem.motion.rememberReducedMotion
import mx.violetcode.mobile.core.designsystem.theme.ThemeMode
import mx.violetcode.mobile.core.designsystem.theme.isDark
import mx.violetcode.mobile.feature.auxilio.AuxilioScreen
import mx.violetcode.mobile.feature.cuenta.LoginScreen
import mx.violetcode.mobile.feature.cuenta.RegistroScreen
import mx.violetcode.mobile.feature.directorio.DirectorioScreen
import mx.violetcode.mobile.feature.inicio.InicioScreen
import mx.violetcode.mobile.feature.orientacion.OrientacionScreen
import mx.violetcode.mobile.feature.ajustes.AjustesScreen

/** Rutas de cuenta (no son pestañas de la barra inferior). */
private const val ROUTE_LOGIN = "login"
private const val ROUTE_REGISTRO = "registro"

/** Ajustes de seguridad (modo discreto). Fuera de la barra inferior: se abre desde la barra superior. */
private const val ROUTE_AJUSTES = "ajustes"

private enum class Destination(
    val route: String,
    val label: String,
    val icon: ImageVector,
    val selectedIcon: ImageVector,
) {
    Inicio("inicio", "Inicio", Icons.Outlined.Home, Icons.Filled.Home),
    Auxilio("auxilio", "Auxilio", Icons.Outlined.Sos, Icons.Filled.Sos),
    Orientacion("orientacion", "Orientación", Icons.AutoMirrored.Outlined.MenuBook, Icons.AutoMirrored.Filled.MenuBook),
    Directorio("directorio", "Directorio", Icons.Outlined.Place, Icons.Filled.Place),
    // «Mi caso» (Seguimiento) queda fuera del MVP (RF-31): sin pestaña, sin ruta y sin acceso desde Inicio.
    // SeguimientoScreen se conserva sin enlazar para habilitarla cuando exista el módulo de expedientes.
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VioletApp(
    themeMode: ThemeMode,
    onThemeModeChange: (ThemeMode) -> Unit,
    onQuickExit: () -> Unit,
) {
    val nav = rememberNavController()
    val current by nav.currentBackStackEntryAsState()
    val darkTheme = themeMode.isDark()

    fun navigateTab(route: String) {
        nav.navigate(route) {
            popUpTo(nav.graph.findStartDestination().id) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    // Cambio de pestaña = navegación lateral: solo desvanecer, corto (sin deslizar).
    val reducedMotion = rememberReducedMotion()
    val enterFade = if (reducedMotion) EnterTransition.None
    else fadeIn(tween(VioletMotion.TabFadeMillis, delayMillis = 60, easing = VioletEasing.Flow))
    val exitFade = if (reducedMotion) ExitTransition.None
    else fadeOut(tween(100, easing = VioletEasing.Flow))

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Violet Code", fontWeight = FontWeight.SemiBold) },
                actions = {
                    IconButton(onClick = { nav.navigate(ROUTE_AJUSTES) { launchSingleTop = true } }) {
                        Icon(Icons.Outlined.Settings, contentDescription = "Ajustes")
                    }
                    ThemeModeSwitch(
                        darkTheme = darkTheme,
                        onDarkThemeChange = { dark -> onThemeModeChange(if (dark) ThemeMode.Dark else ThemeMode.Light) },
                    )
                    // Salida rápida siempre visible (requisito de seguridad de la usuaria).
                    val exitSource = remember { MutableInteractionSource() }
                    TextButton(
                        onClick = onQuickExit,
                        interactionSource = exitSource,
                        modifier = Modifier.pressScale(exitSource),
                    ) {
                        Icon(Icons.Outlined.Close, contentDescription = null)
                        Text("Salir rápido", maxLines = 1)
                    }
                },
            )
        },
        bottomBar = {
            NavigationBar {
                Destination.entries.forEach { dest ->
                    NavItem(
                        destination = dest,
                        selected = current?.destination?.route == dest.route,
                        onClick = { navigateTab(dest.route) },
                    )
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = nav,
            startDestination = Destination.Inicio.route,
            modifier = Modifier.padding(padding),
            enterTransition = { enterFade },
            exitTransition = { exitFade },
            popEnterTransition = { enterFade },
            popExitTransition = { exitFade },
        ) {
            composable(Destination.Inicio.route) {
                InicioScreen(
                    onEmergency = { navigateTab(Destination.Auxilio.route) },
                    onOrientacion = { navigateTab(Destination.Orientacion.route) },
                    onDirectorio = { navigateTab(Destination.Directorio.route) },
                )
            }
            composable(Destination.Auxilio.route) {
                AuxilioScreen(
                    onLogin = { nav.navigate(ROUTE_LOGIN) { launchSingleTop = true } },
                    onRegister = { nav.navigate(ROUTE_REGISTRO) { launchSingleTop = true } },
                )
            }
            composable(Destination.Orientacion.route) { OrientacionScreen(onHelp = { navigateTab(Destination.Auxilio.route) }) }
            composable(Destination.Directorio.route) { DirectorioScreen() }
            composable(ROUTE_AJUSTES) { AjustesScreen() }
            // Cuenta (RF-33): fuera de la barra inferior. Al terminar se regresa a la pantalla previa (Auxilio).
            composable(ROUTE_LOGIN) {
                LoginScreen(
                    onSignedIn = { nav.popBackStack() },
                    onRegister = { nav.navigate(ROUTE_REGISTRO) { popUpTo(ROUTE_LOGIN) { inclusive = true } } },
                )
            }
            composable(ROUTE_REGISTRO) {
                RegistroScreen(
                    onSignedIn = { nav.popBackStack() },
                    onGoLogin = { nav.navigate(ROUTE_LOGIN) { popUpTo(ROUTE_REGISTRO) { inclusive = true } } },
                )
            }
        }
    }
}

/** Ítem de la barra inferior: ícono relleno al estar seleccionado y presión elástica en el ícono. */
@Composable
private fun RowScope.NavItem(destination: Destination, selected: Boolean, onClick: () -> Unit) {
    val source = remember { MutableInteractionSource() }
    NavigationBarItem(
        selected = selected,
        onClick = onClick,
        icon = {
            Icon(
                imageVector = if (selected) destination.selectedIcon else destination.icon,
                contentDescription = null,
                modifier = Modifier.pressScale(source, pressedScale = 0.85f),
            )
        },
        label = { Text(destination.label, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        interactionSource = source,
    )
}
