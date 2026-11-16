# Violet Code Mobile

App Android de la usuaria. Kotlin + Jetpack Compose + Material 3, **MVVM**.

Abrir `apps/mobile` en Android Studio (JDK 17, SDK 35) y correr en emulador. En debug la API es `http://10.0.2.2:5080/` (localhost de la PC). En dispositivo físico, cambiar `API_BASE_URL` en `app/build.gradle.kts` a la IP de la PC.

## Estructura

```
mx.violetcode.mobile/
  MainActivity.kt          FLAG_SECURE + salida rápida
  ui/                      VioletApp (navegación), theme/, components/
  data/network/            ApiClient (Retrofit)
  feature/
    auxilio/               botón 911 (alerta silenciosa pendiente D-01)
    directorio/            ejemplo MVVM completo: Data (API + repo) → ViewModel (StateFlow) → Screen
    orientacion/           pendiente: violentómetro y triaje
    seguimiento/           pendiente: solicitudes y estado del caso
```

**Agregar un feature:** copiar el patrón de `feature/directorio`.

## Tema

`ui/theme/VioletColors.kt` lo **genera** `npm run tokens` (mismo color que el panel web). No editar a mano.

> Tailwind no aplica en Android nativo: Compose no usa CSS. La consistencia visual con el panel se logra con los mismos tokens de color y radios (ver ADR-0002).

## Seguridad de la usuaria (ya incluido)

- Botón **Salir rápido** siempre visible (cierra y quita la app de recientes).
- `FLAG_SECURE`: sin capturas ni vista previa en recientes; `excludeFromRecents`.
- Sin respaldos en la nube (`allowBackup=false`, reglas de extracción).
- HTTPS obligatorio salvo contra el emulador local.
