# `get_expediente_detalle`

- **Migración:** [`20261128000900_48_edad_en_expediente.sql`](../../migrations/20261128000900_48_edad_en_expediente.sql) *(actualiza [`20261126000800_18_rpc_detalle_y_archivo.sql`](../../migrations/20261126000800_18_rpc_detalle_y_archivo.sql))*
- **Permiso RBAC:** `tiene_permiso('expediente.ver')`
- **Actores autorizados:** `titular`, `subdireccion`, `trabajo_social`, `psicologia`, `juridico` (`recepcion` y `umeca` denegados).

## 1. Entrada (`parámetros`)
| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_ficha_id` | `uuid` | Sí | Identificador de la ficha activa a consultar. |
| `p_incluir_agresores` | `boolean` | No | Default `false`. Si es `true`, incluye `agresores` y registra también consulta de `'agresor'` en bitácora. |

## 2. Salida
Objeto `jsonb` único con:
- `ficha`: datos de `ficha_registro` + `ocupacion_nombre`.
- `persona`: datos de `persona` + `edad` calculada en servidor (`calcular_edad()`).
- `servicios_solicitados`: arreglo `{ area_id, clave, nombre }`.
- `domicilio_actual`: domicilio actual activo (o `null`).
- `estudio_actual`: estudio socioeconómico actual activo + `aportantes` (o `null`).
- `orden_vigente`: `boolean`.
- `citas_hoy`: citas activas del día (`America/Mazatlan`) filtradas por el rol del actor.
- `agresores`: arreglo de agresores activos *(solo si `p_incluir_agresores = true`)*, incluyendo `edad` calculada cuando tiene `fecha_nacimiento`.

## 3. Reglas ABAC y efectos secundarios
- Inserta `'ver'` en `public.bitacora_acceso` para `ficha_registro` (y para `agresor` si `p_incluir_agresores = true`).
- `citas_hoy` aplica el mismo filtro por área que `cita_select` (Dirección ve todas; Trabajo Social ve TS y Psicología; Psicología y Jurídico solo su área).

## 4. Errores esperados
| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Sin permiso (`recepcion`, `umeca`, inactivo o sin sesión). |
| `23514` | `p_ficha_id` nulo o expediente inexistente/inactivo. |
