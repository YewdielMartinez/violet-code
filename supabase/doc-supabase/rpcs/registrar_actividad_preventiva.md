# RPC: `public.registrar_actividad_preventiva`

- **Migración:** `supabase/migrations/20261126001600_26_rpc_actividades_preventivas.sql`
- **Permiso RBAC:** `public.tiene_permiso('actividad.registrar')`
- **Actores autorizados:** `titular`, `subdireccion`, `trabajo_social`, `psicologia`, `juridico`
- **Cubre:** `RF-16` (B-05 · Sprint 01)

## 1. Entrada (`p_payload jsonb`)

Objeto JSON con los datos de la actividad preventiva y la lista opcional de empleados participantes:

| Campo | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `titulo` | `text` | Sí | Entre 1 y 200 caracteres (sin espacios extremos) |
| `tipo_actividad_id` | `smallint` | Sí | ID existente en `public.cat_tipo_actividad` |
| `tipo_institucion` | `tipo_institucion_actividad` | Sí | `'escuela' \| 'empresa_privada' \| 'sector_publico' \| 'comunidad' \| 'otro'` |
| `nivel_educativo` | `nivel_educativo` | No | `'primaria' \| 'secundaria' \| 'preparatoria' \| 'universidad'`. Solo permitido si `tipo_institucion = 'escuela'` |
| `sede` | `text` | Sí | Nombre del plantel, empresa o recinto (1 a 200 caracteres) |
| `direccion` | `text` | No | Máximo 250 caracteres |
| `referencias` | `text` | No | Máximo 250 caracteres |
| `asentamiento_id` | `integer` | No | ID existente en `public.cat_asentamiento` |
| `programada_en` | `timestamptz` | Sí | Fecha y hora ISO-8601 válida |
| `numero_asistentes` | `smallint` | No | Entero entre `0` y `10000` |
| `participantes_ids` | `uuid[]` | No | Arreglo JSON de UUIDs de empleados activos (`public.empleado.activo = true`); se deduplican antes de insertar |

## 2. Salida (`table`)

| Columna | Tipo | Descripción |
|---|---|---|
| `actividad_id` | `uuid` | UUID generado en `public.actividad_preventiva` |
| `total_participantes` | `integer` | Cantidad de participantes únicos insertados en `public.actividad_empleado` |

## 3. Reglas ABAC y efectos secundarios
- Valida el permiso `actividad.registrar` mediante `public.tiene_permiso('actividad.registrar')` (rechaza `recepcion`, `umeca`, `anon` y empleados inactivos).
- Inserta en `public.actividad_preventiva` y en `public.actividad_empleado` dentro de la misma transacción; si falla la validación de algún participante, no se persiste la actividad.
- Registra `creado_por = auth.uid()` en ambas tablas.

## 4. Errores esperados

| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Sesión inválida, `anon`, UMECA, empleado inactivo o rol sin permiso (`recepcion`) |
| `23514` | Payload no objeto, campos requeridos faltantes/vacíos, enum o formato inválido, `nivel_educativo` con `tipo_institucion <> 'escuela'`, `tipo_actividad_id` o `asentamiento_id` inexistentes, `numero_asistentes` fuera de rango o algún participante inexistente/inactivo |
