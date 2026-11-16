package mx.violetcode.mobile.core.designsystem.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import mx.violetcode.mobile.core.designsystem.R

/**
 * DM Sans (fuente de motion-kit, licencia OFL: ver FONT-LICENSE-DMSans-OFL.txt).
 * Es una fuente variable (ejes opsz, wght) en res/font/dm_sans.ttf; se instancian los pesos usados.
 * Requiere API 26+ (minSdk del proyecto) para aplicar la variación de peso.
 */
@OptIn(ExperimentalTextApi::class)
private fun dmSans(weight: FontWeight): Font = Font(
    resId = R.font.dm_sans,
    weight = weight,
    variationSettings = FontVariation.Settings(FontVariation.weight(weight.weight)),
)

val DmSansFamily = FontFamily(
    dmSans(FontWeight.Normal),
    dmSans(FontWeight.Medium),
    dmSans(FontWeight.SemiBold),
    dmSans(FontWeight.Bold),
)

/** Escala tipográfica de Material 3 con DM Sans. */
internal val VioletTypography: Typography = Typography().let { base ->
    Typography(
        displayLarge = base.displayLarge.copy(fontFamily = DmSansFamily),
        displayMedium = base.displayMedium.copy(fontFamily = DmSansFamily),
        displaySmall = base.displaySmall.copy(fontFamily = DmSansFamily),
        headlineLarge = base.headlineLarge.copy(fontFamily = DmSansFamily),
        headlineMedium = base.headlineMedium.copy(fontFamily = DmSansFamily),
        headlineSmall = base.headlineSmall.copy(fontFamily = DmSansFamily),
        titleLarge = base.titleLarge.copy(fontFamily = DmSansFamily),
        titleMedium = base.titleMedium.copy(fontFamily = DmSansFamily),
        titleSmall = base.titleSmall.copy(fontFamily = DmSansFamily),
        bodyLarge = base.bodyLarge.copy(fontFamily = DmSansFamily),
        bodyMedium = base.bodyMedium.copy(fontFamily = DmSansFamily),
        bodySmall = base.bodySmall.copy(fontFamily = DmSansFamily),
        labelLarge = base.labelLarge.copy(fontFamily = DmSansFamily),
        labelMedium = base.labelMedium.copy(fontFamily = DmSansFamily),
        labelSmall = base.labelSmall.copy(fontFamily = DmSansFamily),
    )
}
