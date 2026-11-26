# Pendientes: edición del expediente y gestión de usuarias de la app

> Estado: **propuesta, sin implementar.** Sin migraciones ni tarjetas en Notion.
> Fecha: 26-nov-2026 · Complementa [`backlog-canalizaciones-y-folio-seguimiento.md`](./backlog-canalizaciones-y-folio-seguimiento.md).
> Estándar: [`docs/estandar-servicios-y-rpcs.md`](../../../docs/estandar-servicios-y-rpcs.md) (plpgsql, `security definer`, `tiene_permiso()`, errores `42501`/`23514`/`23505`, contrato de 4 puntos en `doc-supabase/rpcs/`).

**Decisión de Angel (26-nov):** por ahora **no** se guarda historial de valores anteriores. Se conserva la bitácora actual (`bitacora_acceso`: quién, cuándo, qué tabla y qué registro), que ya llena el trigger `registrar_cambio()`.

---

## Parte A. Edición del expediente por RPC

### Por qué

Hoy casi toda edición es `update` directo desde el front con RLS (`persona`, `ficha_registro`, `agresor`, `historial_clinico`, `estudio_socioeconomico`). Eso tiene tres problemas:

1. Las reglas de negocio (qué campos se pueden cambiar, en qué estado del expediente, formato de datos) dependen de la pantalla.
2. El front puede mandar columnas que no debería tocar (`activo`, `folio`, `persona_id`, `curp`).
3. Cada pantalla repite la lógica, y las dos apps (web y futura) pueden divergir.

Con RPC, cada edición valida permiso, estado del expediente y campos permitidos en el servidor. Al terminar, se cierra el `update` directo en RLS para esas tablas (queda solo la RPC).

### Reglas comunes a todas

- `security definer`, `set search_path = public`, `tiene_permiso('<clave>')` al inicio (`42501`).
- No se edita un expediente `archivado` (`23514`, "Reabre el expediente para editarlo"), salvo `reabrir_ficha`.
- **Bloqueo optimista:** cada RPC recibe `p_actualizado_en` (el valor que vio la pantalla). Si no coincide, `23505` "Este registro fue modificado por otra persona. Recarga los datos." Así dos personas no se pisan sin saberlo (hoy solo `agresor` lo hace, desde el front).
- Parámetros con `null` = "no cambiar". Para borrar un campo opcional, cadena vacía `''`.
- Devuelven la fila actualizada (con su nuevo `actualizado_en`).
- La bitácora la sigue llenando el trigger; no se agrega nada.

### E-1. `actualizar_persona`

| | |
|---|---|
| Permiso | `expediente.escribir` (Dirección y TS) |
| Parámetros | `p_persona_id`, `p_actualizado_en`, `p_nombres`, `p_apellido_paterno`, `p_apellido_materno`, `p_celular`, `p_escolaridad`, `p_discapacidad`, `p_grupo_etnico`, `p_religion` |
| No se puede cambiar | `curp`, `sexo`, `fecha_nacimiento`, `entidad_nacimiento` (salen de la CURP), `activo` |
| Reglas | Celular de 10 dígitos; nombre 1..100. |
| **Por decidir** | Corregir una CURP mal capturada: ¿RPC aparte solo para Dirección (`corregir_curp`), que valide que no exista otra persona con esa CURP y que vuelva a ligar el pre-registro? |

### E-2. `actualizar_ficha`

| | |
|---|---|
| Permiso | `expediente.escribir` |
| Parámetros | `p_ficha_id`, `p_actualizado_en`, `p_estado_civil`, `p_ocupacion_id`, `p_ocupacion_otra`, `p_tiene_trabajo`, `p_numero_hijas`, `p_numero_hijos_hombres`, `p_servicio_medico`, `p_servicio_medico_otro`, `p_tiene_embarazo`, `p_tiene_denuncia`, `p_es_victima_delito`, `p_tiene_consumo_droga`, `p_drogas`, `p_especificacion_droga`, `p_tiene_consumo_alcohol`, `p_servicios_solicitados_area_ids` |
| No se puede cambiar | `folio`, `persona_id`, `estado` (tiene sus propias RPC), `aviso_privacidad_aceptado_en`, `registrada_en`, `activo` |
| Reglas | `ocupacion_otra` solo si la ocupación es "otra"; `drogas` solo si `tiene_consumo_droga`; al menos un servicio solicitado. Los servicios solicitados se actualizan desactivando los quitados (no `delete`), lo que también resuelve H-3. |

### E-3. `guardar_agresor`

| | |
|---|---|
| Permiso | `agresor.acceder` (Dirección, TS, Psicología, Jurídico) |
| Parámetros | `p_agresor_id` (`null` = crear), `p_ficha_id`, `p_actualizado_en` (solo al editar) y los campos de `agresor` (nombre, parentesco, domicilio, ocupación, consumo, `especificacion_arma`, observaciones) |
| Reglas | `parentesco_otro` solo si el parentesco es "otro"; `drogas` solo con consumo. Se valida que la ficha esté activa y no archivada. |
| Quitar | `desactivar_agresor(p_agresor_id, p_motivo)`: `activo = false`. No se puede si tiene una orden de protección vigente ligada. |
| Front | Reemplaza `SupabaseAgresorRepository.crear` y `.actualizar`. |

### E-4. `guardar_historial_clinico`

| | |
|---|---|
| Permiso | `historial_clinico.acceder` (Dirección y Psicología) |
| Parámetros | `p_ficha_id`, `p_actualizado_en` (`null` si es la primera vez), `p_antecedentes_familiares`, `p_antecedentes_personales`, `p_motivo_consulta`, `p_observaciones_iniciales`, `p_tiene_atencion_psicologica_previa` |
| Reglas | Crea si no existe, actualiza si existe (uno por ficha). Psicología solo con persona mayor de edad (RN-01). |
| Lectura | `get_historial_clinico(p_ficha_id)` que además registra `'ver'` en bitácora (hoy la lectura es `.from()` sin bitácora). |

### E-5. `registrar_estudio_socioeconomico`

| | |
|---|---|
| Permiso | `expediente.escribir` |
| Parámetros | `p_ficha_id` y los campos del estudio, con `p_aportantes jsonb` |
| Reglas | **No edita el estudio anterior:** crea uno nuevo con `fecha_estudio = hoy`, marca el anterior `es_actual = false` y copia los aportantes nuevos. La tabla ya está diseñada así (índice único "un estudio actual por ficha"), así que el historial de estudios sale gratis sin guardar "valores anteriores". |
| Por decidir | ¿Se permite corregir el estudio del mismo día en lugar de crear otro? Propuesta: sí, si es del mismo día y lo hizo la misma persona. |

### E-6. Corregir `archivar_ficha`

- Guardar `p_motivo`. Propuesta: columnas nuevas en `ficha_registro`: `motivo_archivo text`, `archivada_en timestamptz`, `archivada_por uuid`.
- Motivo obligatorio (`23514` si viene vacío).

### E-7. `reabrir_ficha`

| | |
|---|---|
| Permiso | `expediente.escribir` (**por decidir:** ¿solo Dirección?) |
| Parámetros | `p_ficha_id`, `p_motivo` (obligatorio) |
| Reglas | Solo desde `archivado`. Pasa a `en_seguimiento` si tiene atenciones, o a `abierto` si no. Limpia `motivo_archivo`/`archivada_en` y guarda `reabierta_en`, `reabierta_por`, `motivo_reapertura`. |

### Cierre de RLS (después de E-1 a E-5)

| Tabla | Hoy | Después |
|---|---|---|
| `persona`, `ficha_registro`, `ficha_servicio_solicitado` | `update` con `expediente.escribir` | `update` cerrado (solo RPC) |
| `agresor` | `insert`/`update` con `agresor.acceder` | cerrado |
| `historial_clinico` | `insert`/`update` con `historial_clinico.acceder` | cerrado |
| `estudio_socioeconomico`, `aportante_hogar` | `insert`/`update` con `expediente.escribir` | cerrado |

El `select` no cambia. `crear_ficha_completa` sigue funcionando porque es `security definer`.

### Pruebas (pgTAP)

Por RPC: rol sin permiso → `42501`; expediente archivado → `23514`; `p_actualizado_en` viejo → `23505`; campo prohibido no cambia; la bitácora registra `'actualizar'`.

---

## Parte B. Gestión de usuarias de la app móvil

### Situación actual

| Tema | Hoy |
|---|---|
| Cuentas | Empleadas y usuarias de la app comparten el mismo Supabase Auth (`auth.users`). Se distinguen solo porque las empleadas tienen fila en `empleado`. |
| Registro | `enable_signup = true`, **sin confirmación de correo** (`enable_confirmations = false`) y contraseña mínima de 6. Cualquiera puede crear una cuenta. |
| Pre-registro | La usuaria inserta su `pre_registro` con su CURP. Un trigger (`ligar_pre_registro_al_crear`) busca esa CURP en `persona` y, si existe, **la liga automáticamente** (`persona_id`, `estado = 'ligado'`). Y al revés: cuando TS crea una persona, se liga sola cualquier pre-registro con esa CURP. |
| Lo que ve la usuaria | Por `get_mi_pre_registro`: solo sus datos, sin `persona_id` ni `estado` (B-06). |
| App Kotlin | Usa la *anon key* como `Authorization` si no hay otra; todo está cerrado a `anon`, así que hoy no funciona sin el token de la usuaria. |

### Riesgos de seguridad

| # | Riesgo | Impacto |
|---|---|---|
| R-1 | **Suplantación por CURP.** La CURP no es secreta. Cualquiera (incluida la persona agresora) puede crear una cuenta con la CURP de la víctima, y el sistema la liga sola a su expediente. | Sus alertas aparecen en la cola con el nombre, folio y colonia de la víctima, y con prioridad alta si ella tiene orden vigente. TS puede precargar datos falsos. |
| R-2 | **Bloqueo de la víctima.** Solo puede haber un pre-registro activo por CURP. Si alguien registró su CURP primero, la víctima no puede crear el suyo. | La víctima pierde el botón de auxilio. |
| R-3 | **Mismo pool de cuentas.** Una empleada puede iniciar sesión en la app, y una usuaria en la web. Las reglas lo frenan (una usuaria no tiene permisos), pero no hay separación explícita. | Confusión y superficie de ataque mayor. |
| R-4 | **Registro abierto sin verificar correo** y contraseña corta. | Cuentas falsas en masa y alertas falsas. |
| R-5 | **Sin límite de alertas** por cuenta. | Saturación de la cola 24/7. |

### Qué da Supabase Auth y qué va en RPC

| Necesidad | Quién lo resuelve | Notas |
|---|---|---|
| Registro de cuenta (correo y contraseña) | **Supabase Auth** (`/auth/v1/signup`) | No se hace RPC de login ni de registro: la contraseña nunca debe pasar por una función propia. |
| Inicio de sesión, renovación de sesión, cerrar sesión | **Supabase Auth** (`/auth/v1/token`, `/logout`) | La app guarda `access_token` y `refresh_token` en almacenamiento cifrado (EncryptedSharedPreferences / Keystore). |
| Recuperar contraseña, verificar correo | **Supabase Auth** | Activar `enable_confirmations = true` en producción. |
| Marcar la cuenta como "usuaria de la app" | **Servidor** (trigger o RPC) | Ver U-1. |
| Crear el perfil de la usuaria (pre-registro) | **RPC** `registrar_mi_perfil` | Ver U-2. |
| Ver y editar su perfil | **RPC** `get_mi_pre_registro`, `actualizar_mi_pre_registro` | Ya existen (B-06). |
| Ligar con un expediente | **RPC del personal**, nunca automático | Ver U-3. |
| Saber si puede enviar alertas | **RPC** `get_mi_estado_app` | Ver U-4. |
| Desactivar su cuenta | **RPC** `desactivar_mi_cuenta` | Ver U-5. |

### Trabajo propuesto

**U-1. Separar tipos de cuenta**
- Guardar el tipo en `auth.users.raw_app_meta_data.tipo` (`'empleado'` o `'usuaria_app'`). `app_metadata` solo lo puede escribir el servidor, no la usuaria.
- Trigger en `auth.users` (alta): por defecto `tipo = 'usuaria_app'`. Las empleadas se crean por un proceso de Dirección (`cuentas.gestionar`) que pone `tipo = 'empleado'` y crea la fila en `empleado`.
- Helpers: `es_usuaria_app()` (lee el claim del JWT) y validación en `es_empleado_activo()` de que el tipo sea `empleado`.
- La web rechaza sesiones `usuaria_app`; la app rechaza sesiones `empleado`.

**U-2. `registrar_mi_perfil` (reemplaza el `insert` directo en `pre_registro`)**
- Parámetros: `p_curp`, `p_nombres`, `p_apellido_paterno`, `p_apellido_materno`, `p_celular`, `p_acepto_aviso boolean`.
- Toma `auth_user_id` de `auth.uid()` (no lo manda la app). Exige `es_usuaria_app()`.
- **No liga automáticamente** con `persona` (quita el comportamiento de `ligar_pre_registro_al_crear` y de `ligar_persona_con_pre_registro`).
- Devuelve los mismos campos que `get_mi_pre_registro`, sin `persona_id` ni `estado`.
- **Por decidir (R-2):** quitar la unicidad de CURP activa en `pre_registro`, para que una CURP pueda tener varias cuentas sin ligar y solo una ligada (la que verificó el personal).

**U-3. Vinculación segura con el expediente (solo personal, en persona)**
- Flujo propuesto:
  1. La usuaria, en la app, pide "vincular con SEMUJERES". RPC `generar_codigo_vinculacion()` crea un código de 6 dígitos que vence en 15 minutos (se guarda solo su hash).
  2. En la oficina, TS verifica la identificación de la persona y captura el código en el expediente.
  3. RPC `vincular_cuenta_app(p_ficha_id, p_codigo)` (permiso `expediente.escribir`): valida código y vigencia, que la CURP del pre-registro coincida con la de la persona, y liga `persona_id`. Registra en bitácora.
  4. RPC `desvincular_cuenta_app(p_persona_id, p_motivo)` para quitar una cuenta ligada por error o comprometida.
- La usuaria nunca sabe ni ve nada del expediente (RF-33, RNF-02): la app solo puede saber "vinculada sí/no" (U-4), si negocio lo aprueba.
- Las alertas de cuentas **no ligadas** siguen llegando a la cola, pero sin nombre ni datos del expediente (solo lo que la usuaria capturó) y marcadas "sin verificar".

**U-4. `get_mi_estado_app()`**
- Devuelve: `tiene_perfil boolean`, `puede_enviar_alertas boolean`, `alertas_hoy int`, `vinculada boolean` (**por decidir** si se muestra: puede revelar que existe un expediente).
- Sin `persona_id`, `folio` ni datos del expediente.

**U-5. `desactivar_mi_cuenta()`**
- `pre_registro.activo = false` y desliga; la cuenta de Auth la elimina un proceso de Dirección o un Edge Function con la llave de servicio (una RPC no puede borrar en `auth.users` de forma segura).
- Derechos ARCO (RN-15.1): la información del expediente no se toca.

**U-6. Límite de alertas**
- `enviar_alerta(p_asentamiento_id)` reemplaza el `insert` directo: toma el `pre_registro_id` de la sesión, aplica un límite (por ejemplo 3 por hora; **por decidir**) y devuelve el id y estado. Cierra el `insert` directo de la app en RLS.

**U-7. Configuración de Auth (producción)**
- `enable_confirmations = true`, `minimum_password_length = 8` o más, y rate limit de registro.
- App Kotlin: interceptor con el `access_token` de la sesión (no la *anon key*) y renovación automática.

### Pruebas (pgTAP)

- Una cuenta `usuaria_app` no pasa `es_empleado_activo()` aunque alguien le inserte fila en `empleado` sin tipo.
- `registrar_mi_perfil` no liga con `persona` aunque la CURP exista.
- `vincular_cuenta_app` falla con código vencido, código ajeno o CURP distinta; queda en bitácora.
- Ninguna RPC de la app devuelve `persona_id`, `folio`, `estado` ni datos del expediente.
- `enviar_alerta` respeta el límite.

---

## Parte C. Decisiones abiertas

| # | Decisión | Propuesta |
|---|---|---|
| 1 | ¿Corregir la CURP de una persona? ¿Quién? | RPC aparte, solo Dirección. |
| 2 | ¿Reabrir expediente: Dirección o también TS? | Solo Dirección. |
| 3 | ¿Corregir el estudio socioeconómico del mismo día o siempre crear uno nuevo? | Corregir el mismo día; después, uno nuevo. |
| 4 | ¿Permitir varias cuentas de app con la misma CURP sin ligar? (R-2) | Sí; solo una puede quedar ligada. |
| 5 | ¿Vinculación con código en persona (U-3) o solo por TS sin código? | Con código: prueba que quien tiene el teléfono es la usuaria. |
| 6 | ¿La app puede saber si está vinculada? | No por ahora (revela que existe un expediente). |
| 7 | Límite de alertas por cuenta. | 3 por hora, configurable. |
| 8 | ¿Quitar la liga automática por CURP de los datos que ya existen? | Sí: desligar todo y volver a vincular con U-3. Requiere avisar a negocio. |

---

## Parte D. Orden y reparto (2 devs)

| Orden | Dev A (expediente) | Dev B (app) |
|---|---|---|
| 1 | E-6 motivo de archivo + E-7 reabrir | U-1 tipos de cuenta |
| 2 | E-1 `actualizar_persona` + E-2 `actualizar_ficha` | U-2 `registrar_mi_perfil` sin liga automática |
| 3 | E-3 `guardar_agresor` | U-3 vinculación con código |
| 4 | E-4 historial clínico + E-5 estudio | U-4, U-5, U-6 |
| 5 | Cierre de RLS de la Parte A | U-7 configuración y app Kotlin |

Funciones compartidas: `tiene_permiso()` (si se agregan claves) y `es_empleado_activo()` (U-1). Hacer U-1 en su propia migración antes que las demás de la Parte B.

### Redacción para tarjetas (no creadas)

```text
Tarea: [Supabase] Crear RPC actualizar_persona y actualizar_ficha con bloqueo optimista
Status: Sin empezar

Tarea: [Supabase] Crear RPC guardar_agresor y desactivar_agresor
Status: Sin empezar

Tarea: [Supabase] Crear RPC guardar_historial_clinico y get_historial_clinico con bitácora
Status: Sin empezar

Tarea: [Supabase] Crear RPC registrar_estudio_socioeconomico como nueva versión del estudio
Status: Sin empezar

Tarea: [Supabase] Guardar motivo en archivar_ficha y crear RPC reabrir_ficha
Status: Sin empezar

Tarea: [Supabase] Separar cuentas de empleadas y usuarias de la app con app_metadata
Status: Sin empezar

Tarea: [Supabase] Quitar la liga automática por CURP y crear vinculación con código en persona
Status: Sin empezar

Tarea: [Supabase] Crear RPC registrar_mi_perfil, get_mi_estado_app, enviar_alerta y desactivar_mi_cuenta
Status: Sin empezar
```
