# RPC: `public.actualizar_mi_pre_registro`

- **Versión:** [`20261126001700_27`](../../migrations/20261126001700_27_pre_registro_seguro.sql)
- **Migración:** `supabase/migrations/20261126001700_27_pre_registro_seguro.sql`
- **Permiso RBAC:** propiedad por `auth.uid()` (no usa `tiene_permiso()`)
- **Actores autorizados:** usuaria autenticada de la app móvil dueña de su `pre_registro` activo
- **Cubre:** `RF-33`, `RNF-02` (`SF-00` · B-06 · Sprint 01)

## 1. Entrada (parámetros)

Todos los parámetros son opcionales con default `null`. Cuando un parámetro se envía como `null`, conserva su valor actual. En campos opcionales (`p_apellido_materno`, `p_celular`), enviar cadena vacía `''` limpia el campo a `null`.

| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_nombres` | `text` | No | Si viene definido, entre 1 y 100 caracteres (sin espacios extremos) |
| `p_apellido_paterno` | `text` | No | Si viene definido, entre 1 y 100 caracteres (sin espacios extremos) |
| `p_apellido_materno` | `text` | No | Si viene definido, máximo 100 caracteres (`''` → `null`) |
| `p_celular` | `text` | No | Si viene definido y no vacío, exactamente 10 dígitos (`^[0-9]{10}$`; `''` → `null`) |

## 2. Salida (`table`)

Devuelve la fila actualizada **sin exponer `persona_id` ni `estado`**:

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` | Identificador del `pre_registro` |
| `curp` | `text` | CURP actual (solo lectura en este RPC) |
| `nombres` | `text` | Nombre(s) actualizado(s) |
| `apellido_paterno` | `text` | Primer apellido actualizado |
| `apellido_materno` | `text` | Segundo apellido actualizado |
| `celular` | `text` | Celular actualizado |
| `actualizado_en` | `timestamptz` | Fecha/hora de actualización |

## 3. Reglas ABAC y efectos secundarios
- Valida propiedad por `pr.auth_user_id = auth.uid()` y `pr.activo = true`.
- Nunca modifica `curp`, `estado`, `persona_id`, `auth_user_id` ni `activo`.
- El trigger `pre_registro_actualizado` refresca `actualizado_en` y `pre_registro_bitacora` registra el cambio.

## 4. Errores esperados

| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Sesión no autenticada (`anon` o `auth.uid() is null`) |
| `23514` | La sesión no tiene un `pre_registro` activo, longitudes fuera de rango (`nombres`/`apellidos`) o `celular` distinto de 10 dígitos |
