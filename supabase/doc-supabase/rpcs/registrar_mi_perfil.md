# `registrar_mi_perfil`

- **Migración:** [`20261127001300_45_rpc_perfil_usuaria_app.sql`](../../migrations/20261127001300_45_rpc_perfil_usuaria_app.sql)
- **Permiso:** `es_usuaria_app()` + propiedad por `auth.uid()`.

## 1. Entrada
| Parámetro | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `p_curp` | `text` | Sí | CURP oficial (18 caracteres). |
| `p_nombres` | `text` | Sí | Nombre(s) de la usuaria. |
| `p_apellido_paterno` | `text` | Sí | Primer apellido. |
| `p_apellido_materno` | `text` | No | Segundo apellido. |
| `p_celular` | `text` | No | 10 dígitos si se envía. |
| `p_aviso_privacidad_aceptado` | `boolean` | Sí (`true`) | Debe ser `true` (`23514` en caso contrario). |

## 2. Salida
`id`, `curp`, `nombres`, `apellido_paterno`, `apellido_materno`, `celular`, `aviso_privacidad_aceptado_en`, `creado_en`. Nunca devuelve `persona_id` ni `estado`.

## 3. Errores esperados
- `42501`: cuenta distinta a `usuaria_app` (empleada, externo, `anon`).
- `23514`: aviso de privacidad no aceptado, campos obligatorios vacíos o formato inválido.
- `23505`: ya existe un perfil activo para esta cuenta.
