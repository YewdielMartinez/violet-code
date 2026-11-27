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
| `core:data` | Android library | DTO (PostgREST), entidades y DAO (Room), mappers, implementaciones de repositorio, módulo Koin | `core:domain` |
| `core:designsystem` | Android library | `VioletTheme`, colores generados, tipografía, movimiento y componentes reutilizables | nada |
| `app` | Aplicación | Pantallas, ViewModels, navegación, `VioletApplication` (Koin) | todos los anteriores |

Gradle **impide** romper las reglas: `core:domain` no puede importar `android.*`, y los DTO, entidades y DAO son `internal` en `core:data`, así que la UI solo ve modelos de dominio.

## Flujo de una pantalla (ejemplo: Directorio)

```
DirectorioScreen ──collect── DirectorioViewModel ──► ObserveDirectoryUseCase ──► DirectoryRepository (interfaz, domain)
     (Compose)                 (StateFlow de UI)  ──► RefreshDirectoryUseCase          ▲ implementa
                                                                                DirectoryRepositoryImpl (data)
                                                                                 ├─ Room   (lo que ve la UI, funciona offline)
                                                                                 └─ Supabase PostgREST (solo actualiza Room)
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

- Botón **Salir rápido** en la barra superior de **todas** las pantallas (misma posición, a la derecha). Sin modo discreto: abre el inicio del teléfono (o un sitio neutro si la usuaria lo activó en Ajustes) y quita la app de recientes (`finishAndRemoveTask`). Con modo discreto: bloquea y deja a la vista solo la calculadora.
- `FLAG_SECURE` en **todas** las ventanas: `SecureWindowCallbacks` (registrado en `VioletApplication`) lo pone al crear cualquier actividad; `MainActivity` lo repite y, en Android 13+, apaga la captura de recientes (`setRecentsScreenshotEnabled(false)`). Los diálogos y menús de Compose heredan el flag de su ventana (`SecureFlagPolicy.Inherit`).
- `excludeFromRecents`: la app no aparece en recientes, salvo con el modo discreto activo (ver abajo).
- Sin respaldos en la nube (`allowBackup=false`, reglas de extracción).
- HTTPS obligatorio salvo contra el emulador local. Sin logs de cuerpos HTTP.
- Room guarda solo información pública. **Antes de guardar datos de la usuaria, cifrar la base** (p. ej. SQLCipher).

## Directorio (Supabase)

- `core:data` lee `public.directorio_institucion` con el cliente de Supabase (`SupabaseClient.fetchDirectory()`: solo `activo = true`, ordenado por `orden` y `nombre`) y lo guarda en Room; la pantalla siempre lee de Room (offline-first). Muestra teléfono, horario (o «24 horas») y domicilio público.
- **Refugios (`categoria = 'refugio'`) nunca muestran ni esperan domicilio:** la BD lo prohíbe con un `CHECK`; el mapper lo descarta otra vez, la lectura de Room lo ignora y la tarjeta tampoco lo pinta (con prueba en `DirectoryMappersTest`).
- **RLS:** `directorio_institucion_select` es `to authenticated using (activo or es_empleado_activo())` y `supabase/doc-supabase/api/app-movil.md` indica que `anon` no lee tablas. Sin sesión, `refresh()` falla con `Unauthorized` (401/403); la pantalla muestra lo guardado y, si no hay nada, los números nacionales de `EmergencyFallback` (911 y 089, sin domicilio) con un aviso para iniciar sesión. Para ver el directorio completo antes de registrarse haría falta una migración **nueva** (las aplicadas no se editan) con `grant select` a `anon` y una política `to anon using (activo)`: es un catálogo público.
- La línea de apoyo que se ofrece en el Violentómetro sale de este mismo directorio (`ObserveSupportHotlineUseCase`: primero `linea_apoyo`; si no hay, la primera de emergencia).

## Violentómetro (Orientación, RF-26 / 26.1)

Pestaña **Orientación**: escala orientativa de 0 a 30 con las tres zonas y las conductas de la imagen oficial (`core:domain/.../violentometro/Violentometro.kt`; la imagen omite 25–26 y se conserva así). La usuaria marca las conductas que ha vivido o desliza el marcador; ambos mueven la misma escala (la conducta marcada más alta manda). El mensaje de la zona se anuncia a TalkBack (región viva), el marcador expone su estado y cada fila es una casilla con descripción. En «¡Reacciona!» y «¡Necesitas ayuda profesional!» aparecen **Ir al Botón de Ayuda** (navega a Auxilio) y **Llamar** a la línea de apoyo del directorio; en la última, además, un recordatorio del 911. Contraste: el texto sobre cada color de nivel es blanco o negro, el de mayor contraste (≥ 4,5:1; `ViolentometroColorsTest` lo verifica en los 31 niveles), y no hay texto sobre el degradado continuo.

**No se guarda nada:** el estado vive solo en memoria (`OrientacionViewModel`: sin `SavedStateHandle`, base de datos ni red). Persistir respuestas o puntaje requiere consentimiento explícito (RF-26.1) y hoy no existe ese flujo.

## «Mi caso» (Seguimiento)

Fuera del MVP (RF-31): sin pestaña, sin ruta y sin tarjeta en Inicio. `SeguimientoScreen` queda en el código sin enlazar.

## Modo discreto (calculadora con PIN)

Para que, si alguien revisa el teléfono, la app no se vea. **Ajustes** (engrane en la barra superior) → **Modo discreto**.

**Activar**
1. Activar el interruptor y crear un PIN de 4 a 6 dígitos (con confirmación).
2. El ícono y el nombre del launcher cambian a **«Calculadora»** (ícono neutro). `MainActivity` no tiene filtro de launcher: hay dos `<activity-alias>` (`.LauncherNormal`, activo por defecto, y `.LauncherCalculator`, desactivado) que `DisguiseController` alterna con `PackageManager.setComponentEnabledSetting(..., DONT_KILL_APP)` (enciende el nuevo antes de apagar el anterior). Algunos launchers tardan unos segundos en refrescar.
3. «Recientes» muestra «Calculadora» con su ícono (`setTaskDescription` + `setExcludeFromRecents(false)`); el contenido sale en blanco por `FLAG_SECURE`.

**Usar**
- Al abrir, **siempre** aparece una calculadora básica totalmente funcional (+ − × ÷, %, ±, decimales, borrar, «=» repetido), con paleta y tipografía neutras: sin logos, textos ni colores de la app.
- Escribir el PIN (4–6 dígitos sueltos) y pulsar **=** abre la app. Si no coincide, «=» se comporta como en cualquier calculadora (muestra el número): sin mensaje, vibración ni cambio visual.
- **Bloqueo:** al pasar a segundo plano (no al girar la pantalla), tras 2 minutos sin tocar la pantalla y con **Salir rápido** (vuelve a la calculadora al instante). El estado «desbloqueado» solo existe en memoria: si el proceso muere, pide el PIN.
- En Ajustes: **Cambiar PIN**, **Bloquear ahora** y desactivar (borra el PIN y restaura nombre e ícono). **Si se olvida el PIN no hay recuperación** (solo borrar datos o reinstalar); por eso se avisa al crearlo. Si el PIN guardado no se puede leer (llave del Keystore invalidada), el modo discreto se desactiva solo para no dejarla fuera.

**Cómo se guarda el PIN** (`core:domain/.../disguise/Pin.kt`, `app/.../disguise/DisguiseStore.kt`)
- Nunca en claro: PBKDF2-HMAC-SHA256 (120 000 iteraciones) con sal aleatoria de 16 bytes y comparación en tiempo constante.
- El texto resultante (`v1$iteraciones$sal$hash`) se cifra además con AES-GCM usando una llave de **Android Keystore** (no exportable) antes de ir a SharedPreferences (archivo y claves con nombres genéricos). Sin respaldos.
- **Fuerza bruta:** un PIN de 4–6 dígitos no resiste intentos ilimitados, por eso hay un retraso creciente y persistente: 4 fallos gratis; del 5.º en adelante la comprobación se bloquea 30 s, 1 min, 2 min… hasta 15 min (también contra el PIN correcto, sin avisar en pantalla). Se reinicia con un acierto o al cambiar el PIN. Nota: como el desbloqueo se detecta al pulsar «=» tras 4–6 dígitos sueltos, teclear un número así en la calculadora cuenta como intento; es raro en uso real y no cambia nada de lo visible.

**Pruebas** (`./gradlew test`): `CalculatorEngineTest` (calculadora y detección del candidato a PIN), `PinTest` (hash, verificación, formato, retraso y bloqueo), `ViolentometroTest`, `ViolentometroColorsTest`, `OrientacionViewModelTest`, `DirectoryMappersTest`, `ObserveSupportHotlineUseCaseTest`.

**Probar en el emulador**
1. `./gradlew :app:installDebug` y abrir «Violet Code». Ajustes (engrane) → Modo discreto → crear PIN (p. ej. 1234).
2. Ir al inicio del emulador: el ícono ahora es «Calculadora». Abrirla, calcular `2+3=` (da 5), escribir `1234` y `=`: se abre la app.
3. Pulsar **Salir rápido**: vuelve la calculadora. Mandar la app a segundo plano y regresar: pide PIN. En «Recientes» aparece «Calculadora» con la pantalla en blanco.
4. Equivocarse 5 veces con el PIN: aunque luego se escriba bien, no abre hasta pasar 30 s.
5. Ajustes → desactivar: vuelve el ícono «Violet Code».
