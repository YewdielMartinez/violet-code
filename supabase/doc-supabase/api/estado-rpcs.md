# Estado de las RPC y de las tablas directas

[← Índice](./README.md) · Tablas directas: [tablas-directas.md](./tablas-directas.md)

Corte: 27-nov-2026, rama `develop` con la migración `60_integrar_develop_y_supabase`. El consumo del admin se revisó en `apps/admin/src/infrastructure/supabase/adapters/`.

**Leyenda**

| Columna | Valores |
|---|---|
| Base de datos | ✅ **Implementada**: hay migración en `develop` · 🕓 **Pendiente**: planeada en sprint/backlog, sin migración |
| Admin (adapters) | ✅ ya hay un método que la llama · ❌ no hay código que la consuma · ⚠️ el adapter todavía escribe directo en la tabla (RLS) o manda parámetros que ya no existen · — no aplica (app móvil) |

---

## 1. RPC del admin

### Expediente

| RPC | Migración | Base de datos | Admin (adapters) | Nota |
|---|---|---|---|---|
| [`crear_ficha_completa`](../rpcs/crear_ficha_completa.md) | `10` (última versión en `59`) | ✅ | ✅ `SupabaseFichaRepository.create` | |
| [`get_expediente_detalle`](../rpcs/get_expediente_detalle.md) | `18` (última en `60`) | ✅ | ✅ `SupabaseFichaRepository.getDetail` | |
| [`buscar_expedientes`](../rpcs/buscar_expedientes.md) | `17` (última en `48`) | ✅ | ✅ `SupabaseExpedienteRepository` | |
| [`verificar_curp`](../rpcs/verificar_curp.md) | `17` | ✅ | ✅ `SupabaseExpedienteRepository` | |
| `buscar_pre_registro_por_curp` | `27` | ✅ | ✅ `SupabaseExpedienteRepository` | Sin contrato en `rpcs/`. |
| [`registrar_consulta`](../rpcs/registrar_consulta.md) | `16` | ✅ | ✅ Expediente y Agresor | |
| [`archivar_ficha`](../rpcs/archivar_ficha.md) | `18` (última en `38`) | ✅ | ✅ `SupabaseFichaRepository.archive` | El adapter acepta `motivo` opcional; la RPC lo exige. |
| [`reabrir_ficha`](../rpcs/reabrir_ficha.md) | `38` | ✅ | ✅ `SupabaseFichaRepository.reopen` | |
| [`actualizar_persona`](../rpcs/actualizar_persona.md) | `35` | ✅ | ❌ | |
| [`actualizar_ficha`](../rpcs/actualizar_ficha.md) | `35` (última en `59`) | ✅ | ❌ | |
| [`actualizar_domicilio`](../rpcs/actualizar_domicilio.md) | `49` | ✅ | ⚠️ | La copia de la hoja de seguimiento hace `insert` directo en `domicilio` (cerrado en `49`). |
| [`cambiar_prioridad_expediente`](../rpcs/cambiar_prioridad_expediente.md) | `50` | ✅ | ❌ | |
| [`registrar_estudio_socioeconomico`](../rpcs/registrar_estudio_socioeconomico.md) | `37` | ✅ | ❌ | |
| *(desactivar ficha)* | — | — | ⚠️ | `SupabaseFichaRepository.deactivate` hace `update ficha_registro` directo (cerrado en `39`). No existe RPC; usar `archivar_ficha` o crear una. |

### Agresor

| RPC | Migración | Base de datos | Admin (adapters) | Nota |
|---|---|---|---|---|
| [`guardar_agresor`](../rpcs/guardar_agresor.md) | `36` (última en `57`) | ✅ | ⚠️ | `SupabaseAgresorRepository.crear/actualizar` hacen `insert`/`update` directo (cerrado en `39`). |
| [`desactivar_agresor`](../rpcs/desactivar_agresor.md) | `36` | ✅ | ❌ | |

### Historial clínico

| RPC | Migración | Base de datos | Admin (adapters) | Nota |
|---|---|---|---|---|
| [`get_historial_clinico`](../rpcs/get_historial_clinico.md) | `37` | ✅ | ❌ | No hay adapter de historial clínico. |
| [`guardar_historial_clinico`](../rpcs/guardar_historial_clinico.md) | `37` | ✅ | ❌ | |

### Agenda y citas

| RPC | Migración | Base de datos | Admin (adapters) | Nota |
|---|---|---|---|---|
| [`get_agenda`](../rpcs/get_agenda.md) | `22` (última en `60`) | ✅ | ⚠️ `SupabaseCitaRepository` | El mapeo todavía lee `prioridad`, que la `50`/`60` quitó de la salida. |
| [`crear_cita`](../rpcs/crear_cita.md) | `51` | ✅ | ⚠️ | `SupabaseCitaRepository.crear` hace `insert` directo en `cita` con `prioridad` (cerrado en `51`). |
| [`cambiar_estado_cita`](../rpcs/cambiar_estado_cita.md) | `22` (última en `47`) | ✅ | ✅ `SupabaseCitaRepository` | |
| [`reagendar_cita`](../rpcs/reagendar_cita.md) | `23` (última en `60`) | ✅ | ⚠️ | El adapter manda `p_prioridad`, que ya no existe en la firma. |
| [`get_lista_urgencias`](../rpcs/get_lista_urgencias.md) | `23` (última en `52`) | ✅ | ✅ `SupabaseCitaRepository` | Revisar el mapeo: la salida cambió a `prioridad_actualizada_en`. |
| [`buscar_personas_agenda`](../rpcs/buscar_personas_agenda.md) | `42_agenda` | ✅ | ✅ `SupabaseCitaRepository` | |
| [`get_umeca_citas`](../rpcs/get_umeca_citas.md) | `05` | ✅ | ✅ `SupabaseAuthRepository` | Está en el adapter de Auth, no en el de Cita. |

### Seguimiento (atención)

| RPC | Migración | Base de datos | Admin (adapters) | Nota |
|---|---|---|---|---|
| [`registrar_seguimiento`](../rpcs/registrar_seguimiento.md) | `19` (última en `60`) | ✅ | ✅ `SupabaseSeguimientoRepository.registrar` | Después llama a la copia de la hoja, que hace `update` directo en `atencion` (cerrado en `43`) ⚠️. |
| [`get_contexto_seguimiento`](../rpcs/get_contexto_seguimiento.md) | `42_rpc` | ✅ | ❌ | Hoy el contexto se arma leyendo `ficha_registro`, `persona` y `domicilio` por separado. |
| [`corregir_seguimiento`](../rpcs/corregir_seguimiento.md) | `43` | ✅ | ❌ | |
| [`get_linea_tiempo`](../rpcs/get_linea_tiempo.md) | `20` (última en `34`) | ✅ | ✅ `SupabaseSeguimientoRepository` | |

### Canalizaciones (derivaciones)

| RPC | Migración | Base de datos | Admin (adapters) | Nota |
|---|---|---|---|---|
| [`crear_canalizacion`](../rpcs/crear_canalizacion.md) | `33` | ✅ | ✅ `SupabaseDerivacionRepository.create` | |
| [`get_derivaciones`](../rpcs/get_derivaciones.md) | `25` (última en `34`) | ✅ | ✅ `SupabaseDerivacionRepository` | |
| [`cambiar_estado_derivacion`](../rpcs/cambiar_estado_derivacion.md) | `25` (última en `34`) | ✅ | ✅ `SupabaseDerivacionRepository.updateEstado` | |
| [`get_historial_canalizaciones`](../rpcs/get_historial_canalizaciones.md) | `34` | ✅ | ❌ | |
| `get_canalizaciones_por_agendar` | — | 🕓 | ❌ | Opción A del backlog de canalizaciones (bandeja de Recepción). |

### Alertas

| RPC | Migración | Base de datos | Admin (adapters) | Nota |
|---|---|---|---|---|
| [`get_cola_alertas`](../rpcs/get_cola_alertas.md) | `24` (última en `47`) | ✅ | ✅ Alerta y Dashboard | |
| [`tomar_alerta`](../rpcs/tomar_alerta.md) | `24` (última en `47`) | ✅ | ✅ `SupabaseAlertaRepository` | |
| [`atender_alerta`](../rpcs/atender_alerta.md) | `24` (última en `47`) | ✅ | ✅ `SupabaseAlertaRepository` | |

### Actividades preventivas

| RPC | Migración | Base de datos | Admin (adapters) | Nota |
|---|---|---|---|---|
| [`get_actividades_preventivas`](../rpcs/get_actividades_preventivas.md) | `26` | ✅ | ✅ `SupabaseActividadPreventivaRepository` | |
| [`registrar_actividad_preventiva`](../rpcs/registrar_actividad_preventiva.md) | `26` | ✅ | ✅ `SupabaseActividadPreventivaRepository` | |
| [`actualizar_estado_actividad`](../rpcs/actualizar_estado_actividad.md) | `41_actividad` | ✅ | ✅ `SupabaseActividadPreventivaRepository` | |

### Informes y bitácora

| RPC | Migración | Base de datos | Admin (adapters) | Nota |
|---|---|---|---|---|
| [`get_informe`](../rpcs/get_informe.md) | `28` | ✅ | ✅ `SupabaseInformeRepository` | |
| [`get_bitacora`](../rpcs/get_bitacora.md) | `28` | ✅ | ✅ Informe y Dashboard | |
| `get_mapa_calor_asentamiento` | `15` | ✅ | ❌ | Sin contrato en `rpcs/`. Firma: `(p_umbral_minimo int default 3)` → `asentamiento_id, codigo_postal, nombre, tipo_asentamiento, municipio, estado, latitud, longitud, total_expedientes, total_alertas, total_actividades`. |

---

## 2. RPC de la app móvil (usuarias)

No las consume el admin; se listan para tener el inventario completo.

| RPC | Migración | Base de datos | Nota |
|---|---|---|---|
| [`get_mi_pre_registro`](../rpcs/get_mi_pre_registro.md) | `27` | ✅ | |
| [`actualizar_mi_pre_registro`](../rpcs/actualizar_mi_pre_registro.md) | `27` | ✅ | |
| [`registrar_mi_perfil`](../rpcs/registrar_mi_perfil.md) | `45` | ✅ | |
| [`get_mi_estado_app`](../rpcs/get_mi_estado_app.md) | `45` | ✅ | |
| [`desactivar_mi_cuenta`](../rpcs/desactivar_mi_cuenta.md) | `45` | ✅ | |
| [`enviar_alerta`](../rpcs/enviar_alerta.md) | `46` | ✅ | |
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
| `nota_area` | Alta, edición y baja lógica (solo su área) | `seguimiento.registrar` | ✅ `SupabaseSeguimientoRepository` |
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
