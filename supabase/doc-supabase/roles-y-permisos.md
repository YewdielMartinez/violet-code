# Roles, Permisos y Seguridad en Base de Datos (RBAC + ABAC)

Referencia técnica del modelo de autorización implementado en [20261125000700_07_rls.sql](../migrations/20261125000700_07_rls.sql) sobre PostgreSQL Row Level Security (RLS), complementado con los privilegios SQL base a `authenticated` (sin abrir `anon`) en [20261125000900_09_grants_authenticated.sql](../migrations/20261125000900_09_grants_authenticated.sql).

---

## 1. Modelo elegido y escalabilidad

El sistema utiliza un modelo híbrido **RBAC + ABAC ligero**:
- **RBAC (Control por rol):** distingue los 6 roles internos de `public.rol_empleado` (`titular`, `subdireccion`, `trabajo_social`, `psicologia`, `juridico`, `recepcion`), el usuario externo `umeca` (`public.usuario_externo`) y la usuaria de la app móvil (`public.pre_registro`).
- **ABAC (Control por atributos):** evalúa atributos del registro y del actor directamente en las políticas RLS:
  - `nota_area.area_id = auth_area_id()` (privacidad estricta por área).
  - `cita.area_id` restringido para `recepcion` (`trabajo_social` y `psicologia` únicamente; `juridico` agenda directo).
  - `pre_registro.auth_user_id = auth.uid()` y `alerta` móvil filtrada por pertenencia.
  - Estado `activo = true` requerido en `empleado` y `usuario_externo`.

### Cómo escalar a permisos granulares sin reescribir RLS
Las políticas consumen funciones helper `SECURITY DEFINER STABLE` (`auth_rol()`, `auth_area_id()`, `es_direccion()`, `es_area_atencion()`, `es_linea_24_7()`, `es_umeca()`, `tiene_permiso(p_permiso)`).

- Hoy `tiene_permiso(p_permiso)` resuelve las capacidades en un `CASE` por rol sin costo de joins adicionales.
- Si el sistema requiere permisos por usuario o roles configurables a futuro, basta crear tablas `cat_permiso` / `rol_permiso` / `empleado_permiso` y actualizar **únicamente el cuerpo de `tiene_permiso()`**, sin modificar las políticas RLS de las 32 tablas.

---

## 2. Actores del sistema

| Actor | Origen en BD | Alcance operativo principal |
|---|---|---|
| `titular` / `subdireccion` (`es_direccion()`) | `empleado` | Supervisión global, catálogos, cuentas, directorio, bitácora, línea 24/7, expedientes e informes. **No** lee `nota_area`. |
| `trabajo_social` | `empleado` | Alta/edición de `persona`, `ficha_registro`, `ficha_servicio_solicitado`, `estudio_socioeconomico`, `aportante_hogar`, precarga de `pre_registro`, agenda de TS y Psicología, atenciones de TS y órdenes de protección. |
| `psicologia` | `empleado` | Lectura de Ficha Única, `historial_clinico` propio, `atencion` y `nota_area` de Psicología, su agenda (`cita`) y cola de alertas. |
| `juridico` | `empleado` | Lectura de Ficha Única, su agenda directa (`cita`), `atencion` y `nota_area` de Jurídico, `orden_proteccion` y línea 24/7 (`alerta`). |
| `recepcion` | `empleado` | Lectura básica de `persona` y gestión de `cita` únicamente de `trabajo_social` y `psicologia`. Sin acceso a `ficha_registro`, `agresor`, `atencion`, `nota_area` ni `bitacora_acceso`. |
| `umeca` | `usuario_externo` | Sin acceso directo a tablas operativas. Consulta únicamente mediante el RPC `get_umeca_citas()` (audita cada lectura en `bitacora_acceso`). |
| Usuaria app móvil | `auth.users` + `pre_registro` | Lectura de catálogos y `directorio_institucion`, gestión de su propio `pre_registro` y creación/lectura de sus alertas (`origen = 'app_movil'`). |

---

## 3. Matriz de acceso por tabla y Storage

| Recurso | Dirección (`titular` / `subdireccion`) | `trabajo_social` | `psicologia` | `juridico` | `recepcion` | `umeca` | Usuaria móvil |
|---|---|---|---|---|---|---|---|
| `cat_*` (10 catálogos) | S / I / U | S | S | S | S | S | S |
| `directorio_institucion` | S / I / U | S (activos) | S (activos) | S (activos) | S (activos) | S (activos) | S (activos) |
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
- **`get_umeca_citas()` y `get_mapa_calor_asentamiento()`:** RPCs con validación explícita de rol y registro de auditoría / anonimización (`RF-15`, `RF-21`).
