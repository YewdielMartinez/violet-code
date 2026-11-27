# `crear_cita`

- **Migración:** [`20261128001200_51_rpc_crear_cita.sql`](../../migrations/20261128001200_51_rpc_crear_cita.sql)
- **Permiso RBAC:** `tiene_permiso('agenda.gestionar')`
- **Actores autorizados:**
  - `titular`, `subdireccion`: cualquier área activa.
  - `recepcion`: solo `trabajo_social` y `psicologia`.
  - `trabajo_social`, `psicologia`, `juridico`: solo su propia `area_id`.

## 1. Entrada (`parámetros`)
| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_persona_id` | `uuid` | Sí | Persona activa (si tiene expediente activo, no debe estar `'archivado'`). |
| `p_area_id` | `smallint` | Sí | Área activa en `cat_area`, dentro del alcance del rol. |
| `p_programada_en` | `timestamptz` | Sí | Debe ser futura (`> now()`). |
| `p_recomendada_por` | `text` | No | Texto libre opcional (`<= 200` caracteres). |
| `p_origen` | `public.origen_cita` | No | Default `'regular'` (`'regular'` o `'umeca'`). |

## 2. Salida
| Columna | Tipo | Descripción |
|---|---|---|
| `cita_id` | `uuid` | ID de la cita creada. |
| `persona_id` | `uuid` | ID de la persona. |
| `area_id` | `smallint` | ID del área. |
| `programada_en` | `timestamptz` | Fecha/hora programada. |
| `estado` | `public.estado_cita` | Siempre `'agendada'`. |
| `origen` | `public.origen_cita` | `'regular'` o `'umeca'`. |

## 3. Reglas ABAC y RLS
- La inserción directa sobre `public.cita` queda bloqueada con `with check (false)`.
- Evita citas duplicadas activas (`agendada`/`confirmada`) para la misma persona, área y horario (`23514`).
- El trigger `cita_validar_mayoria_edad` bloquea Psicología/Jurídico para menores de 18 años (`23514`, RN-01).

## 4. Errores esperados
| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Sin permiso `agenda.gestionar` o área fuera del alcance del rol (ej. Recepción → Jurídico). |
| `23514` | Parámetro nulo, área/persona inexistente o inactiva, fecha pasada, expediente archivado, menor de edad en Psi/Jur o cita duplicada en misma área/hora. |
