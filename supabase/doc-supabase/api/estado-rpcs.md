# Estado de las RPC y de las tablas directas

[← Índice](./README.md) · Tablas directas: [tablas-directas.md](./tablas-directas.md)

Corte: 27-nov-2026, rama `develop` con la migración `60_integrar_develop_y_supabase`. El consumo del admin se revisó en `apps/admin/src/infrastructure/supabase/adapters/`.

**Versión** de una RPC = `<timestamp>_<número>` de la última migración que hace `create or replace function` sobre ella. Es la misma que aparece bajo cada sección de `api/*.md`. Cuando una migración nueva redefine la RPC, se actualizan las dos.

**Leyenda**

| Columna | Valores |
|---|---|
| Base de datos | ✅ **Implementada**: hay migración en `develop` · 🕓 **Pendiente**: planeada en sprint/backlog, sin migración |
| Admin (adapters) | ✅ ya hay un método que la llama · ❌ no hay código que la consuma · ⚠️ el adapter todavía escribe directo en la tabla (RLS) o manda parámetros que ya no existen · — no aplica (app móvil) |

---

## 1. RPC del admin

### Expediente

| RPC | Versión | Base de datos | Admin (adapters) | Nota |
|---|---|---|---|---|
| [`crear_ficha_completa`](../rpcs/crear_ficha_completa.md) | `20261128001800_60` | ✅ | ✅ `SupabaseFichaRepository.create` | |
| [`get_expediente_detalle`](../rpcs/get_expediente_detalle.md) | `20261128001800_60` | ✅ | ✅ `SupabaseFichaRepository.getDetail` | |
| [`buscar_expedientes`](../rpcs/buscar_expedientes.md) | `20261128000900_48` | ✅ | ✅ `SupabaseExpedienteRepository` | |
| [`verificar_curp`](../rpcs/verificar_curp.md) | `20261126000700_17` | ✅ | ✅ `SupabaseExpedienteRepository` | |
| [`buscar_pre_registro_por_curp`](../rpcs/buscar_pre_registro_por_curp.md) | `20261126000700_17` | ✅ | ✅ `SupabaseExpedienteRepository` | |
| [`registrar_consulta`](../rpcs/registrar_consulta.md) | `20261126000600_16` | ✅ | ✅ Expediente y Agresor | |
| [`archivar_ficha`](../rpcs/archivar_ficha.md) | `20261127000700_38` | ✅ | ✅ `SupabaseFichaRepository.archive` | El adapter acepta `motivo` opcional; la RPC lo exige. |
| [`reabrir_ficha`](../rpcs/reabrir_ficha.md) | `20261127000700_38` | ✅ | ✅ `SupabaseFichaRepository.reopen` | |
| [`actualizar_persona`](../rpcs/actualizar_persona.md) | `20261127000400_35` | ✅ | ✅ `SupabaseFichaRepository.actualizarPersona` | |
| [`actualizar_ficha`](../rpcs/actualizar_ficha.md) | `20261128001700_59` | ✅ | ✅ `SupabaseFichaRepository.actualizar` | |
| [`actualizar_domicilio`](../rpcs/actualizar_domicilio.md) | `20261128001000_49` | ✅ | ✅ `SupabaseFichaRepository.actualizarDomicilio` | |
| [`cambiar_prioridad_expediente`](../rpcs/cambiar_prioridad_expediente.md) | `20261128001100_50` | ✅ | ✅ `SupabaseFichaRepository.cambiarPrioridad` | |
| [`registrar_estudio_socioeconomico`](../rpcs/registrar_estudio_socioeconomico.md) | `20261128001500_57` | ✅ | ✅ `SupabaseFichaRepository.registrarEstudioSocioeconomico` | |
| *(desactivar ficha)* | — | — | ⚠️ `@deprecated` | `SupabaseFichaRepository.deactivate` quedó marcado `@deprecated` (sin RPC; RLS bloquea `42501`). |

### Agresor

| RPC | Versión | Base de datos | Admin (adapters) | Nota |
|---|---|---|---|---|
| [`guardar_agresor`](../rpcs/guardar_agresor.md) | `20261128001600_58` | ✅ | ✅ `SupabaseAgresorRepository.crear` / `actualizar` | |
| [`desactivar_agresor`](../rpcs/desactivar_agresor.md) | `20261127000500_36` | ✅ | ✅ `SupabaseAgresorRepository.desactivar` | |

### Historial clínico

| RPC | Versión | Base de datos | Admin (adapters) | Nota |
|---|---|---|---|---|
| [`get_historial_clinico`](../rpcs/get_historial_clinico.md) | `20261127000600_37` | ✅ | ✅ `SupabaseHistorialClinicoRepository.obtener` | |
| [`guardar_historial_clinico`](../rpcs/guardar_historial_clinico.md) | `20261128002600_67` | ✅ | ✅ `SupabaseHistorialClinicoRepository.guardar` | Solo Psicología (`historial_clinico.escribir`) |
| [`get_historial_clinico_versiones`](../rpcs/get_historial_clinico_versiones.md) | `20261128002600_67` | ✅ | ✅ `SupabaseHistorialClinicoRepository.versiones` | Histórico de cambios |

### Agenda y citas

| RPC | Versión | Base de datos | Admin (adapters) | Nota |
|---|---|---|---|---|
| [`get_agenda`](../rpcs/get_agenda.md) | `20261128001800_60` | ✅ | ✅ `SupabaseCitaRepository.listarAgenda` | |
| [`crear_cita`](../rpcs/crear_cita.md) | `20261128001800_60` | ✅ | ✅ `SupabaseCitaRepository.crear` | |
| [`cambiar_estado_cita`](../rpcs/cambiar_estado_cita.md) | `20261128001800_60` | ✅ | ✅ `SupabaseCitaRepository` | |
| [`reagendar_cita`](../rpcs/reagendar_cita.md) | `20261128001800_60` | ✅ | ✅ `SupabaseCitaRepository.reagendar` | |
| [`get_lista_urgencias`](../rpcs/get_lista_urgencias.md) | `20261128001300_52` | ✅ | ✅ `SupabaseCitaRepository.listarUrgencias` | Mapea `prioridad_actualizada_en`. |
| [`buscar_personas_agenda`](../rpcs/buscar_personas_agenda.md) | `20261127001100_42` | ✅ | ✅ `SupabaseCitaRepository` | |
| [`get_umeca_citas`](../rpcs/get_umeca_citas.md) | `20261127001100_42` | ✅ | ✅ `SupabaseAuthRepository` | Está en el adapter de Auth, no en el de Cita. |

### Seguimiento (atención)

| RPC | Versión | Base de datos | Admin (adapters) | Nota |
|---|---|---|---|---|
| [`registrar_seguimiento`](../rpcs/registrar_seguimiento.md) | `20261128001800_60` | ✅ | ✅ `SupabaseSeguimientoRepository.registrar` | |
| [`get_contexto_seguimiento`](../rpcs/get_contexto_seguimiento.md) | `20261128001400_54` | ✅ | ✅ `SupabaseSeguimientoRepository.contexto` | |
| [`corregir_seguimiento`](../rpcs/corregir_seguimiento.md) | `20261128001400_54` | ✅ | ✅ `SupabaseSeguimientoRepository.corregir` | |
| [`get_linea_tiempo`](../rpcs/get_linea_tiempo.md) | `20261128001400_54` | ✅ | ✅ `SupabaseSeguimientoRepository` | |

### Canalizaciones (derivaciones)

| RPC | Versión | Base de datos | Admin (adapters) | Nota |
|---|---|---|---|---|
| [`crear_canalizacion`](../rpcs/crear_canalizacion.md) | `20261127000200_33` | ✅ | ✅ `SupabaseDerivacionRepository.create` | |
| [`get_derivaciones`](../rpcs/get_derivaciones.md) | `20261127000300_34` | ✅ | ✅ `SupabaseDerivacionRepository` | |
| [`cambiar_estado_derivacion`](../rpcs/cambiar_estado_derivacion.md) | `20261127000300_34` | ✅ | ✅ `SupabaseDerivacionRepository.updateEstado` | |
| [`get_historial_canalizaciones`](../rpcs/get_historial_canalizaciones.md) | `20261127000300_34` | ✅ | ✅ `SupabaseDerivacionRepository.historialCanalizaciones` | |
| `get_canalizaciones_por_agendar` | — | 🕓 | ❌ | Opción A del backlog de canalizaciones (bandeja de Recepción). |

### Alertas

| RPC | Versión | Base de datos | Admin (adapters) | Nota |
|---|---|---|---|---|
| [`get_cola_alertas`](../rpcs/get_cola_alertas.md) | `20261128000800_47` | ✅ | ✅ Alerta y Dashboard | |
| [`tomar_alerta`](../rpcs/tomar_alerta.md) | `20261128000800_47` | ✅ | ✅ `SupabaseAlertaRepository` | |
| [`atender_alerta`](../rpcs/atender_alerta.md) | `20261128000800_47` | ✅ | ✅ `SupabaseAlertaRepository` | |

### Actividades preventivas

| RPC | Versión | Base de datos | Admin (adapters) | Nota |
|---|---|---|---|---|
| [`get_actividades_preventivas`](../rpcs/get_actividades_preventivas.md) | `20261127001000_41` | ✅ | ✅ `SupabaseActividadPreventivaRepository` | |
| [`registrar_actividad_preventiva`](../rpcs/registrar_actividad_preventiva.md) | `20261126001600_26` | ✅ | ✅ `SupabaseActividadPreventivaRepository` | |
| [`actualizar_estado_actividad`](../rpcs/actualizar_estado_actividad.md) | `20261127001000_41` | ✅ | ✅ `SupabaseActividadPreventivaRepository` | |

### Informes y bitácora

| RPC | Versión | Base de datos | Admin (adapters) | Nota |
|---|---|---|---|---|
| [`get_informe`](../rpcs/get_informe.md) | `20261126001800_28` | ✅ | ✅ `SupabaseInformeRepository` | |
| [`get_bitacora`](../rpcs/get_bitacora.md) | `20261126001800_28` | ✅ | ✅ Informe y Dashboard | |
| [`get_mapa_calor_asentamiento`](../rpcs/get_mapa_calor_asentamiento.md) | `20261126000500_15` | ✅ | ✅ `SupabaseDashboardRepository.mapaCalor` |

### Autenticación y perfil

| RPC | Versión | Base de datos | Admin (adapters) | Nota |
|---|---|---|---|---|
| [`get_mi_perfil`](../rpcs/get_mi_perfil.md) | `20261128002800_69` | ✅ | ✅ `SupabaseAuthRepository` | Reemplaza lectura directa de `empleado` y `usuario_externo` en login. |

---

### Mi perfil

| RPC | Versión | Base de datos | Admin (adapters) | Nota |
|---|---|---|---|---|
| [`get_mi_perfil`](../rpcs/get_mi_perfil.md) | `20261128003100_72` | ✅ | ✅ `SupabaseAuthRepository.miPerfil` | Perfil propio y permisos efectivos (`permisos_catalogo()` + `tiene_permiso()`). Cast temporal hasta regenerar tipos. |
| [`actualizar_mi_perfil`](../rpcs/actualizar_mi_perfil.md) | `20261128003100_72` | ✅ | ✅ `SupabaseAuthRepository.actualizarMiPerfil` | Solo nombre y teléfono. La contraseña usa `auth.updateUser` (`cambiarContrasena`). |

## 2. RPC de la app móvil (usuarias)

No las consume el admin; se listan para tener el inventario completo.

| RPC | Versión | Base de datos | Nota |
|---|---|---|---|
| [`get_mi_pre_registro`](../rpcs/get_mi_pre_registro.md) | `20261126001700_27` | ✅ | |
| [`actualizar_mi_pre_registro`](../rpcs/actualizar_mi_pre_registro.md) | `20261126001700_27` | ✅ | |
| [`registrar_mi_perfil`](../rpcs/registrar_mi_perfil.md) | `20261128000600_45` | ✅ | |
| [`get_mi_estado_app`](../rpcs/get_mi_estado_app.md) | `20261128000600_45` | ✅ | |
| [`desactivar_mi_cuenta`](../rpcs/desactivar_mi_cuenta.md) | `20261128000600_45` | ✅ | |
| [`enviar_alerta`](../rpcs/enviar_alerta.md) | `20261128000700_46` | ✅ | |
| `generar_codigo_vinculacion` | — | 🕓 | Backlog de usuarias de la app (vincular con SEMUJERES). |

Las funciones internas (`tiene_permiso`, `auth_rol`, `auth_area_id`, `puede_crear_cita_en_area`, `calcular_edad`, `generar_folio_*`, triggers de bitácora y validación) no se llaman desde el front y no se listan.

---

## 3. Operaciones que siguen con RLS directo a las tablas

Estas no tienen RPC a propósito: son catálogos u operaciones de una sola tabla y la RLS decide quién puede hacer qué (ver [tablas-directas.md](./tablas-directas.md)).

| Tabla | Operación | Quién escribe (RLS) | Admin (adapters) |
|---|---|---|---|
| `cat_area`, `cat_asentamiento`, `cat_ocupacion`, `cat_parentesco`, `cat_tipo_atencion`, `cat_tipo_actividad`, `cat_tipo_documento` | Lectura (escritura solo Tit/Sub) | `catalogos.gestionar` | ✅ Sepomex, Agresor, Seguimiento, Documento |
| `directorio_institucion` | Lectura y gestión | `directorio.gestionar` | ✅ `SupabaseDirectorioRepository` |
| `orden_proteccion` | Alta, edición y baja lógica | `orden_proteccion.escribir` | ✅ `SupabaseOrdenProteccionRepository` |
| `documento` + Storage | Subida, URL firmada y baja lógica | `expediente.ver` | ✅ `SupabaseDocumentoStorageRepository` |
| `nota_area` | Alta, edición y baja lógica (solo su área; las de Psicología además exigen `nota_psicologia.acceder`) | `seguimiento.registrar` | ✅ `SupabaseSeguimientoRepository` |
| `empleado`, `usuario_externo` | Alta y edición de cuentas | Tit/Sub | ✅ `SupabaseUsuarioRepository`, `SupabaseAuthRepository` |
| `persona`, `ficha_registro`, `alerta`, `vista_lista_urgencias` | Solo lectura | `expediente.ver` / `alertas.ver` | ✅ Expediente, Dashboard, Alerta |

### Tablas que ya están cerradas a escritura directa

Cualquier `insert`/`update` directo devuelve `42501`; se usa la RPC indicada.

| Tabla | Cerrada en | Usar |
|---|---|---|
| `persona` | `39` | `crear_ficha_completa`, `actualizar_persona` |
| `ficha_registro` | `39` | `crear_ficha_completa`, `actualizar_ficha`, `archivar_ficha`, `reabrir_ficha`, `cambiar_prioridad_expediente` |
| `ficha_servicio_solicitado`, `estudio_socioeconomico`, `aportante_hogar` | `39` | `crear_ficha_completa`, `actualizar_ficha`, `registrar_estudio_socioeconomico` |
| `agresor` | `39` | `guardar_agresor`, `desactivar_agresor` |
| `historial_clinico` | `39` | `guardar_historial_clinico` |
| `derivacion` (alta) | `33` | `crear_canalizacion` |
| `atencion` | `43` | `registrar_seguimiento`, `corregir_seguimiento` |
| `domicilio` | `49` | `actualizar_domicilio` |
| `cita` (alta) | `51` | `crear_cita` |

> ⚠️ [tablas-directas.md](./tablas-directas.md) todavía muestra `insert` directo en `derivacion` y dice que `atencion` admite escritura directa; ambas quedaron cerradas en `33` y `43`. Hay que corregir esas secciones.

---

## 4. Resumen

| | Base de datos | Admin ya la consume | Falta en admin | Admin escribe directo o manda parámetros viejos |
|---|---|---|---|---|
| RPC del admin (41 implementadas + 1 pendiente) | 41 ✅ · 1 🕓 | 25 | 11 (+1 pendiente) | 5 (`guardar_agresor`, `crear_cita`, `reagendar_cita`, `get_agenda`, `actualizar_domicilio`) + la copia de la hoja después de `registrar_seguimiento` + `deactivate` de ficha sin RPC |
| RPC de la app (6 implementadas + 1 pendiente) | 6 ✅ · 1 🕓 | — | — | — |
