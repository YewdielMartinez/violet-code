# `registrar_seguimiento`

- **Migración:** [`20261126000900_19_rpc_registrar_seguimiento.sql`](../../migrations/20261126000900_19_rpc_registrar_seguimiento.sql)
- **Permiso RBAC:** `tiene_permiso('seguimiento.registrar')` + `auth_area_id() is not null`
- **Actores autorizados:** `trabajo_social`, `psicologia`, `juridico` (cada área sobre sus propias citas y tipos de atención).

## 1. Entrada (`parámetros`)
| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_ficha_id` | `uuid` | Sí | Expediente activo al que pertenece el seguimiento. |
| `p_cita_id` | `uuid` | No | Cita asociada (`null` si es atención sin cita previa). Debe estar `'agendada'` o `'confirmada'` y pertenecer a la persona y área del actor. |
| `p_tipo_atencion_id` | `smallint` | Sí | ID de `cat_tipo_atencion` perteneciente al área del actor. |
| `p_acciones_realizadas` | `text` | No | Descripción de lo realizado (`<= 5000`). |
| `p_proxima_accion` | `text` | No | Acción siguiente sugerida (`<= 2000`). |
| `p_prioridad` | `public.prioridad_nivel` | No | `'alta'`, `'media'`, `'baja'` o `null`. |
| `p_observaciones` | `text` | No | Observaciones clínicas/operativas (`<= 5000`). |
| `p_proxima_cita_en` | `timestamptz` | No | Si se envía, debe ser futura (`> now()`) y crea la próxima cita en la misma área. **Crear una cita exige `agenda.crear`** (regla vigente desde la migración `20261127001100_42`): `juridico` y `psicologia` pueden agendarla en su área; Trabajo Social recibe `42501` y debe solicitarla a Recepción. |

## 2. Salida
| Columna | Tipo | Descripción |
|---|---|---|
| `atencion_id` | `uuid` | ID de la hoja de seguimiento (`public.atencion`) creada. |
| `cita_proxima_id` | `uuid` | ID de la cita nueva si se envió `p_proxima_cita_en` (`null` en caso contrario). |
| `es_primera_vez_area` | `boolean` | `true` si no existía atención activa previa de esa ficha en esa área (RN-19). |
| `tiene_historial_clinico` | `boolean` | `true` si la ficha ya cuenta con `historial_clinico` activo. |

## 3. Reglas ABAC y efectos secundarios
- El área se resuelve siempre del actor (`auth_area_id()`).
- Si hay `p_cita_id`, la cita pasa a `'asistio'`.
- Si la ficha está en `'abierto'`, pasa automáticamente a `'en_seguimiento'`.
- El trigger `atencion_validar_mayoria_edad` bloquea Psicología/Jurídico para menores de 18 años (`23514`, RN-01).

## 4. Errores esperados
| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Sin permiso `seguimiento.registrar` (`titular`, `subdireccion`, `recepcion`, `umeca`, sin sesión), o `p_proxima_cita_en` enviado por un rol sin `agenda.crear` en su área (Trabajo Social): `Sin permiso para agendar la próxima cita; solicítela a Recepción`. |
| `23514` | Ficha/cita inexistente, tipo de atención de otra área, cita de otra persona/área o estado no válido, fecha de próxima cita no futura o menor de edad en Psicología/Jurídico. |
| `23505` | La cita ya tiene una hoja de seguimiento registrada (`atencion.cita_id` único). |
