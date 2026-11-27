# Contratos de RPCs (Sprint 01)

Cada RPC nuevo o modificado se documenta aquí en su propio archivo `<nombre_rpc>.md` antes de implementarlo, siguiendo la sección §4 de [`docs/estandar-servicios-y-rpcs.md`](../../../docs/estandar-servicios-y-rpcs.md).

## Plantilla de contrato (4 puntos)

```markdown
# `<nombre_rpc>`

- **Versión:** `<YYYYMMDDHHMMSS>_<NN>`: la última migración que redefine la RPC. Si otra migración la vuelve a definir, se actualiza esta línea.
- **Migración:** `<YYYYMMDDHHMMSS>_<NN>_<nombre>.sql` (donde se creó)
- **Permiso RBAC:** `tiene_permiso('<clave>')` *(o `es_umeca()` / propiedad por `auth.uid()`)*
- **Actores autorizados:** ej. `titular`, `subdireccion`, `trabajo_social`

## 1. Entrada (`parámetros` / `payload`)
| Parámetro / Campo | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_ejemplo` | `text` | Sí | Descripción |

## 2. Salida
| Columna / Campo | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` | Identificador |

## 3. Reglas ABAC y efectos secundarios
- Filtros por área / usuario / `activo`.
- Registro en `bitacora_acceso` (si aplica).

## 4. Errores esperados
| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Actor sin permiso o sesión inválida |
| `23514` | Parámetro inválido o regla de negocio incumplida |
| `23505` | Conflicto / duplicado |
```
