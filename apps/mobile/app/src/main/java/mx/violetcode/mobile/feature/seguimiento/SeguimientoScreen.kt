package mx.violetcode.mobile.feature.seguimiento

import androidx.compose.runtime.Composable
import mx.violetcode.mobile.core.designsystem.component.PendingFeature

/** Pendiente: solicitud de orientación y estado del caso (depende de Q-35 y del módulo Cases). */
@Composable
fun SeguimientoScreen() = PendingFeature(
    title = "Mi caso",
    description = "Solicitudes y estado de tu atención. Se habilita cuando exista el módulo de expedientes.",
)
