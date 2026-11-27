# `registrar_seguimiento`

- **Migración:** [`20261127001100_43_corregir_seguimiento.sql`](../../migrations/20261127001100_43_corregir_seguimiento.sql) *(actualiza [`20261127000900_41_folio_seguimiento.sql`](../../migrations/20261127000900_41_folio_seguimiento.sql), [`20261127000800_40_seguimiento_con_asistencia.sql`](../../migrations/20261127000800_40_seguimiento_con_asistencia.sql) y [`20261126000900_19_rpc_registrar_seguimiento.sql`](../../migrations/20261126000900_19_rpc_registrar_seguimiento.sql))*
- **Permiso RBAC:** `tiene_permiso('seguimiento.registrar')` + `auth_area_id() is not null`
- **Actores autorizados:** `trabajo_social`, `psicologia`, `juridico` (cada área sobre sus propias citas del día y tipos de atención).

## 1. Entrada (`parámetros`)
| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_ficha_id` | `uuid` | Sí | Expediente activo al que pertenece el seguimiento. |
| `p_cita_id` | `uuid` | **Sí** | Cita **del día de hoy** (`America/Mazatlan`), en estado `'agendada'` o `'confirmada'`, de la persona del expediente y del área del actor. Si llega sin cita, crear primero la cita del día (`'agendada'`). |
| `p_tipo_atencion_id` | `smallint` | Sí | ID de `cat_tipo_atencion` perteneciente al área del actor. |
| `p_acciones_realizadas` | `text` | No | Descripción de lo realizado (`<= 5000`). |
| `p_proxima_accion` | `text` | No | Acción siguiente sugerida (`<= 2000`). |
| `p_prioridad` | `public.prioridad_nivel` | No | `'alta'`, `'media'`, `'baja'` o `null`. |
| `p_observaciones` | `text` | No | Observaciones clínicas/operativas (`<= 5000`). |
| `p_proxima_cita_en` | `timestamptz` | No | Si se envía, debe ser futura (`> now()`) y crea la próxima cita en la misma área. |

## 2. Salida
| Columna | Tipo | Descripción |
|---|---|---|
| `atencion_id` | `uuid` | ID de la hoja de seguimiento (`public.atencion`) creada. |
| `folio_seguimiento` | `text` | Folio único generado en servidor (formato provisional `SEG-AAAA-NNNNN`). |
| `cita_proxima_id` | `uuid` | ID de la cita nueva si se envió `p_proxima_cita_en` (`null` en caso contrario). |
| `es_primera_vez_area` | `boolean` | `true` si no existía atención activa previa de esa ficha en esa área (RN-19). |
| `tiene_historial_clinico` | `boolean` | `true` si la ficha ya cuenta con `historial_clinico` activo. |

## 3. Reglas ABAC y efectos secundarios
- El área se resuelve siempre del actor (`auth_area_id()`).
- El `folio_seguimiento` se genera siempre en servidor (`generar_folio_seguimiento()` + trigger `BEFORE INSERT OR UPDATE`); el front no puede enviarlo ni modificarlo.
- Exige asistencia a una cita válida del día (`(c.programada_en at time zone 'America/Mazatlan')::date = (now() at time zone 'America/Mazatlan')::date`) y la marca automáticamente como `'asistio'`.
- Si la ficha está en `'abierto'`, pasa automáticamente a `'en_seguimiento'`.
- El trigger `atencion_validar_mayoria_edad` bloquea Psicología/Jurídico para menores de 18 años (`23514`, RN-01).

## 4. Errores esperados
| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Sin permiso `seguimiento.registrar` (`titular`, `subdireccion`, `recepcion`, `umeca`, sin sesión). |
| `23514` | Ficha/cita nula o inexistente, tipo de atención de otra área, cita de otra persona/área, cita de otro día (ayer o mañana), estado distinto de `agendada`/`confirmada`, fecha de próxima cita no futura o menor de edad en Psicología/Jurídico. |
| `23505` | La cita ya tiene una hoja de seguimiento registrada (`atencion.cita_id` único). |
