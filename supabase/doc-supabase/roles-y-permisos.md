# Roles, Permisos y Seguridad en Base de Datos (RBAC + ABAC)

Referencia técnica del modelo de autorización implementado en [20261125000700_07_rls.sql](../migrations/20261125000700_07_rls.sql), actualizado en [20261126000500_15_permisos_rbac_abac.sql](../migrations/20261126000500_15_permisos_rbac_abac.sql) sobre PostgreSQL Row Level Security (RLS), complementado con los privilegios SQL base a `authenticated` (sin abrir `anon`) en [20261125000900_09_grants_authenticated.sql](../migrations/20261125000900_09_grants_authenticated.sql).

---

## 1. Modelo elegido y escalabilidad

El sistema utiliza un modelo híbrido **RBAC + ABAC ligero**:
- **RBAC (Control por acción):** `public.tiene_permiso(p_permiso)` evalúa un `CASE` por rol de `public.empleado` (`titular`, `subdireccion`, `trabajo_social`, `psicologia`, `juridico`, `recepcion`), exigiendo `auth.uid()` y `empleado.activo = true`.
- **ABAC (Control por filas / atributos):** evalúa atributos del registro y del actor en el `WHERE` de cada RPC y en las políticas RLS:
  - `area_id = auth_area_id()` (por ejemplo `nota_area` privada por área o informes por área).
  - `cita.area_id` restringido para `recepcion` (`trabajo_social` y `psicologia` únicamente; `juridico` agenda directo).
  - `activo = true`, `pre_registro.auth_user_id = auth.uid()` y `alerta.origen = 'app_movil'`.
- **Actores fuera de `empleado.rol` y separación por `app_metadata.tipo` ([`20261128000500_44_tipos_de_cuenta.sql`](../migrations/20261128000500_44_tipos_de_cuenta.sql)):** cada cuenta en `auth.users` tiene `raw_app_meta_data.tipo` (`'empleado'`, `'externo'` o `'usuaria_app'` por defecto al registrarse). `es_empleado_activo()` y `auth_rol()` exigen `tipo = 'empleado'`, `es_umeca()` exige `tipo = 'externo'` y `es_usuaria_app()` exige `tipo = 'usuaria_app'`. Para externos y usuarias de la app, `tiene_permiso()` siempre devuelve `false`.

### Claves de permiso centralizadas en `tiene_permiso(p_permiso)`

| Clave | Roles permitidos (`empleado`) |
|---|---|
| `catalogos.gestionar`, `directorio.gestionar`, `cuentas.gestionar`, `bitacora.ver` | `titular`, `subdireccion` |
| `expediente.escribir` | `titular`, `subdireccion`, `trabajo_social` |
| `expediente.ver`, `agresor.acceder`, `derivacion.gestionar`, `actividad.registrar`, `informe.ver` | `titular`, `subdireccion`, `trabajo_social`, `psicologia`, `juridico` |
| `expediente.verificar_curp`, `agenda.ver`, `agenda.gestionar`, `actividad.ver` | Todos los empleados activos (incluye `recepcion`) |
| `seguimiento.registrar` | `trabajo_social`, `psicologia`, `juridico` |
| `urgencias.ver` | `titular`, `subdireccion`, `trabajo_social`, `psicologia`, `recepcion` |
| `historial_clinico.acceder` | `titular`, `subdireccion`, `psicologia` |
| `orden_proteccion.escribir` | `titular`, `subdireccion`, `juridico`, `trabajo_social` |
| `alerta.atender` | `titular`, `subdireccion`, `juridico` (`es_linea_24_7()`) |
| `alerta.ver_cola` | `titular`, `subdireccion`, `juridico`, `trabajo_social`, `psicologia` |

### Cómo escalar a permisos granulares sin reescribir RLS
- Hoy `tiene_permiso(p_permiso)` resuelve las capacidades en un `CASE` por rol sin costo de joins adicionales.
- Si el sistema requiere permisos por usuario o roles configurables a futuro, basta crear tablas `cat_permiso` / `rol_permiso` / `empleado_permiso` y actualizar **únicamente el cuerpo de `tiene_permiso()`**, una vez que todas las políticas RLS migren a `tiene_permiso()` (ver tarea A-06 del Sprint 01; hasta entonces, algunas políticas de `07_rls.sql` aún usan `auth_rol()` directo).

---

## 2. Actores del sistema

| Actor | Origen en BD | Alcance operativo principal |
|---|---|---|
| `titular` / `subdireccion` (`es_direccion()`) | `empleado` | Supervisión global, catálogos, cuentas, directorio, bitácora, línea 24/7, expedientes e informes. **No** lee `nota_area`. |
| `trabajo_social` | `empleado` | Alta/edición de `persona`, `ficha_registro`, `ficha_servicio_solicitado`, `estudio_socioeconomico`, `aportante_hogar`, precarga de `pre_registro`, agenda de TS y Psicología, atenciones de TS y órdenes de protección. |
| `psicologia` | `empleado` | Lectura de Ficha Única, `historial_clinico` propio, `atencion` y `nota_area` de Psicología, su agenda (`cita`) y cola de alertas. |
| `juridico` | `empleado` | Lectura de Ficha Única, su agenda directa (`cita`), `atencion` y `nota_area` de Jurídico, `orden_proteccion` y línea 24/7 (`alerta`). |
| `recepcion` | `empleado` | Gestión de `cita` de `trabajo_social` y `psicologia`. Sin acceso a `ficha_registro`, `agresor`, `atencion`, `nota_area` ni `bitacora_acceso`. *(Nota: actualmente lee `persona` directo; se restringe sin CURP en B-08.)* |
| `umeca` | `usuario_externo` | Sin acceso directo a tablas operativas. Consulta únicamente mediante el RPC `get_umeca_citas()` (audita cada lectura en `bitacora_acceso`). |
| Usuaria app móvil | `auth.users` + `pre_registro` | Lectura de catálogos y `directorio_institucion`, gestión de su propio `pre_registro` y creación/lectura de sus alertas (`origen = 'app_movil'`). |

---

## 3. Matriz de acceso por tabla y Storage (29 tablas y 7 catálogos)

| Recurso | Dirección (`titular` / `subdireccion`) | `trabajo_social` | `psicologia` | `juridico` | `recepcion` | `umeca` | Usuaria móvil |
|---|---|---|---|---|---|---|---|
| `cat_*` (7 catálogos tras migración `11`) | S / I / U | S | S | S | S | S | S |
| `directorio_institucion` | S / I / U | S (incl. inactivos) | S (incl. inactivos) | S (incl. inactivos) | S (incl. inactivos) | S (activos) | S (activos) |
| `empleado`, `usuario_externo` | S / I / U | S | S | S | S | S (propia fila) | — |
| `persona` | S / I / U | S / I / U | S | S | S | — | — |
| `domicilio`, `documento`, `storage.objects` (`documentos`) | S / I / U | S / I / U | S / I / U | S / I / U | — | — | — |
| `ficha_registro`, `ficha_servicio_solicitado`, `estudio_socioeconomico`, `aportante_hogar` | S / I / U | S / I / U *(D en puente)* | S | S | — | — | — |
| `agresor` | S / I / U | S / I / U | S / I / U | S / I / U | — | — | — |
| `orden_proteccion` | S / I / U | S / I / U | S | S / I / U | — | — | — |
| `cita` | S / I / U (todas) | S (`ts`+`psic`) / I / U (`ts`) | S / I / U (`psic`) | S / I / U (`jur`) | S / I / U (`ts`+`psic`) | RPC `get_umeca_citas()` | — |
| `atencion` | S / I / U (todas) | S / I / U (`ts`) | S / I / U (`psic`) | S / I / U (`jur`) | — | — | — |
| `nota_area` | — *(privada)* | S / I / U (`ts`) | S / I / U (`psic`) | S / I / U (`jur`) | — | — | — |
| `historial_clinico` | S / I / U | — | S / I / U | — | — | — | — |
| `derivacion` | S / I / U | S / I / U | S (propia/destino) / I / U | S (propia/destino) / I / U | — | — | — |
| `actividad_preventiva`, `actividad_empleado` | S / I / U | S / I / U | S / I / U | S / I / U | S | — | — |
| `pre_registro` | S / U | S / U | — | — | — | — | S / I / U (propia) |
| `alerta` | S / I / U | S | S | S / I / U | — | — | S / I (propia móvil) |
| `bitacora_acceso` | S | — *(triggers/RPC)* | — *(triggers/RPC)* | — *(triggers/RPC)* | — | — | — |

*(Abreviaturas: **S** = `SELECT`, **I** = `INSERT`, **U** = `UPDATE`, **D** = `DELETE`. Ninguna tabla de negocio admite `DELETE` físico salvo la tabla puente `ficha_servicio_solicitado`.)*

---

## 4. Funciones `SECURITY DEFINER` relacionadas

- **`registrar_cambio()`:** trigger automático de auditoría que inserta en `bitacora_acceso` sin otorgar permisos directos de escritura al cliente sobre la bitácora.
- **`registrar_consulta(p_tabla, p_registro_id)`:** RPC invocable por personal activo y UMECA para dejar registro de lectura en `bitacora_acceso` (`RF-05`, `RF-22`).
- **`ligar_pre_registro_al_crear()` / `ligar_persona_con_pre_registro()`:** vinculan `pre_registro` con `persona` por CURP sin exponer `persona` al rol móvil (`RF-33`).
- **`buscar_pre_registro_por_curp(p_curp)`:** permite únicamente a `titular`, `subdireccion` y `trabajo_social` consultar y precargar un `pre_registro` activo por CURP exacta (`RF-34`).
- **`get_umeca_citas()` y `get_mapa_calor_asentamiento()`:** RPCs con validación de permiso (`es_umeca()` / `tiene_permiso('expediente.ver')`) y registro de auditoría / anonimización (`RF-15`, `RF-21`).
- **`crear_ficha_completa(p_payload)`:** RPC atómico de alta de Ficha Única *(nota: actualmente borra ficha vacía como `definer`; se reemplaza por reutilización con `update` en A-03)*.
