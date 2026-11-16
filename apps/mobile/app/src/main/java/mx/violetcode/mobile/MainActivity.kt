package mx.violetcode.mobile

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import mx.violetcode.mobile.ui.VioletApp
import mx.violetcode.mobile.ui.theme.VioletTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Sin capturas de pantalla ni vista previa en "recientes": protege a la usuaria.
        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        enableEdgeToEdge()
        setContent {
            VioletTheme {
                VioletApp(onQuickExit = ::quickExit)
            }
        }
    }

    /** Salida rápida: cierra la app y la quita de la pila de tareas. */
    private fun quickExit() {
        finishAndRemoveTask()
    }
}
