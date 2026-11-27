package mx.violetcode.mobile

/**
 * Entrada del ícono disfrazado («Calculadora», alias `.LauncherCalculator`). Es exactamente [MainActivity], pero su
 * tema de arranque (`Theme.VioletCode.Splash.Neutral`) es una calculadora gris sin marca, así que ni el logo ni los
 * colores de la app aparecen al abrirla con el modo discreto.
 */
class CalculatorLauncherActivity : MainActivity() {
    override val neutralSplash: Boolean = true
}
