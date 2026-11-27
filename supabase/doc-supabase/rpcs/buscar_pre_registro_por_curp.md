# `buscar_pre_registro_por_curp`

- **Versión:** [`20261126000700_17`](../../migrations/20261126000700_17_rpc_busqueda_expedientes.sql) (origen en `06`)
- **Permiso RBAC:** `tiene_permiso('expediente.escribir')`
- **Actores autorizados:** `titular`, `subdireccion`, `trabajo_social`.
- **Uso:** precargar en la nueva ficha los datos que la usuaria capturó en la app, cuando `verificar_curp` indica que hay pre-registro.

## 1. Entrada (`parámetros`)
| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_curp` | `text` | Sí | Se normaliza con `upper(btrim(...))`. Una CURP vacía o inexistente devuelve 0 filas. |

## 2. Salida
0 o 1 fila (solo pre-registros `activo`).

| Columna | Tipo | Descripción |
|---|---|---|
| `pre_registro_id` | `uuid` | ID del pre-registro. |
| `curp` | `text` | CURP normalizada. |
| `nombres`, `apellido_paterno`, `apellido_materno` | `text` | Nombre capturado en la app. |
| `sexo` | `text` | Sexo capturado. |
| `fecha_nacimiento` | `date` | Fecha de nacimiento. |
| `entidad_nacimiento` | `text` | Entidad de nacimiento. |
| `celular` | `text` | Celular de contacto. |
| `persona_id` | `uuid` | `null` si todavía no está ligado a una persona. |

## 3. Reglas ABAC y RLS
- `security definer`: lee `pre_registro` aunque la RLS no deje al personal leer esa tabla directo.
- No modifica nada. El ligado con la persona ocurre al crear la ficha (`crear_ficha_completa`).

## 4. Errores esperados
| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Sin permiso `expediente.escribir` (Psicología, Jurídico, Recepción, UMECA, app). |

## 5. Llamada
```ts
const { data, error } = await supabase
  .rpc('buscar_pre_registro_por_curp', { p_curp: curp })
  .maybeSingle();
```
