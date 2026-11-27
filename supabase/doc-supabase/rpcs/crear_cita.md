# `crear_cita`

- **Versión:** [`20261128001800_60`](../../migrations/20261128001800_60_integrar_develop_y_supabase.sql)
- **Migración:** [`20261128001200_51_rpc_crear_cita.sql`](../../migrations/20261128001200_51_rpc_crear_cita.sql); regla de alcance vigente desde [`20261128001800_60_integrar_develop_y_supabase.sql`](../../migrations/20261128001800_60_integrar_develop_y_supabase.sql)
- **Permiso RBAC:** `tiene_permiso('agenda.crear')` + `puede_crear_cita_en_area(p_area_id)` (la misma regla que `reagendar_cita` y la próxima cita de `registrar_seguimiento`)
- **Actores autorizados:**
  - `titular`, `subdireccion`: cualquier área activa.
  - `recepcion`: `trabajo_social`, `psicologia` y `juridico`.
  - `juridico`, `psicologia`: solo su propia área.
  - `trabajo_social`: no crea citas (`42501`).

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
| `42501` | Sin permiso `agenda.crear` (Trabajo Social, UMECA, app) o área fuera del alcance del rol (ej. Jurídico → Psicología). |
| `23514` | Parámetro nulo, área/persona inexistente o inactiva, fecha pasada, expediente archivado, menor de edad en Psi/Jur o cita duplicada en misma área/hora. |
