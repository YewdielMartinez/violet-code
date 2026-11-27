# RPC: `public.get_mi_pre_registro`

- **Versión:** [`20261126001700_27`](../../migrations/20261126001700_27_pre_registro_seguro.sql)
- **Migración:** `supabase/migrations/20261126001700_27_pre_registro_seguro.sql`
- **Permiso RBAC:** propiedad por `auth.uid()` (no usa `tiene_permiso()`)
- **Actores autorizados:** usuaria autenticada de la app móvil dueña de su `pre_registro` activo
- **Cubre:** `RF-33`, `RNF-02` (`SF-00` · B-06 · Sprint 01)

## 1. Entrada (parámetros)

No recibe parámetros. Identifica la cuenta mediante `auth.uid()`.

## 2. Salida (`table`)

Devuelve 0 o 1 fila correspondiente al pre-registro activo de la sesión actual, **omitiendo `persona_id` y `estado`** para no revelar si la CURP ya tenía expediente en SEMUJERES:

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` | Identificador del `pre_registro` |
| `curp` | `text` | CURP registrada por la usuaria |
| `nombres` | `text` | Nombre(s) |
| `apellido_paterno` | `text` | Primer apellido |
| `apellido_materno` | `text` | Segundo apellido (opcional) |
| `celular` | `text` | Teléfono celular de 10 dígitos (opcional) |
| `aviso_privacidad_aceptado_en` | `timestamptz` | Marca de aceptación del aviso de privacidad |
| `creado_en` | `timestamptz` | Fecha de creación del pre-registro |

## 3. Reglas ABAC y efectos secundarios
- Filtra estrictamente por `pr.auth_user_id = auth.uid()` y `pr.activo = true`.
- Reemplaza la lectura directa de la tabla `public.pre_registro` desde la app móvil (`pre_registro_select` queda restringida al personal con `expediente.escribir`).
- Operación de solo lectura (`stable`).

## 4. Errores esperados

| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Sesión no autenticada (`anon` o `auth.uid() is null`) |
