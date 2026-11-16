# Violet Code Mobile

App Android de la usuaria. Kotlin + Jetpack Compose + Material 3. **Clean Architecture + MVVM**, inyección con **Koin**, directorio **offline-first** con Room.

Abrir `apps/mobile` en Android Studio (JDK 17, SDK 35) y correr en emulador. En debug la API es `http://10.0.2.2:5080/` (localhost de la PC). En dispositivo físico, cambiar `API_BASE_URL` en `app/build.gradle.kts` a la IP de la PC.

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
| `core:designsystem` | Android library | `VioletTheme`, colores generados, componentes reutilizables | nada |
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

## Seguridad de la usuaria (incluido)

- Botón **Salir rápido** siempre visible (cierra la app y la quita de recientes).
- `FLAG_SECURE` (sin capturas ni vista previa) y `excludeFromRecents`.
- Sin respaldos en la nube (`allowBackup=false`, reglas de extracción).
- HTTPS obligatorio salvo contra el emulador local. Sin logs de cuerpos HTTP.
- Room guarda solo información pública. **Antes de guardar datos de la usuaria, cifrar la base** (p. ej. SQLCipher).
