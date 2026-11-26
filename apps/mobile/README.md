# Violet Code Mobile

App Android de la usuaria. Kotlin + Jetpack Compose + Material 3. **Clean Architecture + MVVM**, inyección con **Koin**, directorio **offline-first** con Room.

Abrir `apps/mobile` en Android Studio (JDK 17, SDK 35) y correr en emulador. En debug usa Supabase local en `http://10.0.2.2:54321/` (localhost de la PC) y lee `SUPABASE_URL` / `SUPABASE_ANON_KEY` desde `apps/mobile/local.properties` o variables de entorno.

```sh
./gradlew test            # pruebas de dominio y ViewModels (sin emulador)
./gradlew assembleDebug   # APK de depuración
```

## Módulos y reglas de dependencia

```
app ───────────────► core:designsystem      (tema, componentes Compose)
 │  ╲
 │   ╲──────────────► core:data ──► core:domain
 ▼                                    ▲
core:domain ◄─────────────────────────┘
```

| Módulo | Tipo | Contiene | Puede depender de |
|---|---|---|---|
| `core:domain` | **Kotlin puro** (sin Android) | Modelos, interfaces de repositorio, casos de uso, `Outcome`/`AppError` | nada (solo coroutines) |
| `core:data` | Android library | DTO (Retrofit), entidades y DAO (Room), mappers, implementaciones de repositorio, módulo Koin | `core:domain` |
| `core:designsystem` | Android library | `VioletTheme`, colores generados, tipografía, movimiento y componentes reutilizables | nada |
| `app` | Aplicación | Pantallas, ViewModels, navegación, `VioletApplication` (Koin) | todos los anteriores |

Gradle **impide** romper las reglas: `core:domain` no puede importar `android.*`, y los DTO, entidades y DAO son `internal` en `core:data`, así que la UI solo ve modelos de dominio.

## Flujo de una pantalla (ejemplo: Directorio)

```
DirectorioScreen ──collect── DirectorioViewModel ──► ObserveDirectoryUseCase ──► DirectoryRepository (interfaz, domain)
     (Compose)                 (StateFlow de UI)  ──► RefreshDirectoryUseCase          ▲ implementa
                                                                                DirectoryRepositoryImpl (data)
                                                                                 ├─ Room   (lo que ve la UI, funciona offline)
                                                                                 └─ Retrofit (solo actualiza Room)
```

- **Reglas de negocio en casos de uso**, no en ViewModels (ej. "emergencias siempre primero").
- **ViewModel:** combina casos de uso y produce un `UiState` inmutable.
- **Errores tipados** (`AppError.Network`, `Unauthorized`…); la pantalla decide el mensaje.
- **Offline-first:** si falla la red y hay datos guardados, se muestran con un aviso.

## Agregar un feature

1. **domain:** modelo + interfaz `XxxRepository` + caso(s) de uso (`operator fun invoke`). Prueba unitaria con repositorio falso.
2. **data:** DTO / entidad / DAO `internal`, mappers, `XxxRepositoryImpl`, registrar en `DataModule.kt`.
3. **app:** registrar casos de uso y ViewModel en `di/AppModule.kt`; pantalla en `feature/xxx/`.

## Tema

`core/designsystem/.../theme/VioletColors.kt` lo **genera** `npm run tokens` (mismo color que el panel web). No editar a mano.
Tailwind no aplica en Android nativo (Compose no usa CSS); la consistencia con el panel viene de los mismos tokens.

## Línea de diseño y microinteracciones

La app comparte la línea del panel web: los colores salen del tema `purple` de `@yewdiel21/motion-kit` (claro y oscuro) y el movimiento imita su vocabulario (`dist/css/tokens.css`). Todo vive en `core:designsystem`; las pantallas no definen curvas ni duraciones sueltas.

| Pieza (`core:designsystem`) | Qué hace | Equivalente en motion-kit |
|---|---|---|
| `motion/VioletMotion.kt` (`VioletEasing`, `VioletMotion`, `rememberReducedMotion`) | Curvas, duraciones y muelle de presión; detecta animaciones del sistema apagadas (`ANIMATOR_DURATION_SCALE == 0`) | `--mk-ease-*`, `--mk-dur*`, `prefers-reduced-motion` |
| `Modifier.pressScale(interactionSource)` | Presión elástica: baja a 0.95 y regresa con `spring(dampingRatio = 0.45, stiffness = 400)` | `--mk-ease-press` ("Motion 400/10") |
| `Modifier.fadeInOnAppear(index)` | Aparición con fade + ascenso de 16 dp, 60 ms de retraso por índice (máx. 8 pasos), una sola vez por elemento | `fade-content` (sin desenfoque) |
| `HoldToConfirmButton` | Botón circular: mantener ~1 s llena un anillo; soltar antes lo regresa; al completar vibra y llama `onConfirm`. Con TalkBack basta el doble toque (acción semántica `onClick`) | `hold-confirm` |
| `ThemeModeSwitch` | Interruptor claro/oscuro con sol que gira hacia luna en la perilla | `glass-switch` con `icons="theme"` |
| `VioletTheme(themeMode)` + `ThemeMode` | Claro / oscuro / sistema sobre `VioletLightScheme` / `VioletDarkScheme`; tipografía DM Sans | temas `purple`, `--mk-font` |

Detalles:

- **Reducir movimiento:** si el sistema tiene las animaciones apagadas, `pressScale`, `fadeInOnAppear`, `ThemeModeSwitch` y las transiciones de pestañas no animan. El tiempo de `HoldToConfirmButton` se mide con el reloj de fotogramas, así que la confirmación sigue exigiendo mantener presionado.
- **Transiciones de pestañas** (`ui/VioletApp.kt`): navegación lateral = solo fade corto (~200 ms), sin deslizar. Los íconos de la barra inferior son rellenos al seleccionarse y se encogen al presionar.
- **Tema elegido por la usuaria:** `ThemePreferences` (app, `SharedPreferences`, clave `theme_mode`, expuesto como `StateFlow` y registrado en Koin) alimenta `VioletTheme` desde `MainActivity`. El interruptor está en la barra superior, junto a "Salir rápido".
- **Tipografía:** DM Sans (OFL) va empaquetada como fuente variable en `core/designsystem/src/main/res/font/dm_sans.ttf`; su licencia está en `core/designsystem/FONT-LICENSE-DMSans-OFL.txt`.
- **Pantallas:** `feature/inicio` (saludo, tarjeta de emergencia, accesos rápidos), `Auxilio` (911 con mantener presionado) y `Directorio` (tarjetas escalonadas, botón de llamada con presión elástica).

## Seguridad de la usuaria (incluido)

- Botón **Salir rápido** siempre visible (cierra la app y la quita de recientes).
- `FLAG_SECURE` (sin capturas ni vista previa) y `excludeFromRecents`.
- Sin respaldos en la nube (`allowBackup=false`, reglas de extracción).
- HTTPS obligatorio salvo contra el emulador local. Sin logs de cuerpos HTTP.
- Room guarda solo información pública. **Antes de guardar datos de la usuaria, cifrar la base** (p. ej. SQLCipher).
