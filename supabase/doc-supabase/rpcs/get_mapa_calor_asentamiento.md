# `get_mapa_calor_asentamiento`

- **Versión:** [`20261126000500_15`](../../migrations/20261126000500_15_permisos_rbac_abac.sql) (origen en `05`)
- **Permiso RBAC:** `tiene_permiso('expediente.ver')`
- **Actores autorizados:** `titular`, `subdireccion`, `trabajo_social`, `psicologia`, `juridico`.
- **Cubre:** `RF-15`, `RF-21` (mapa de calor anonimizado por colonia).

## 1. Entrada (`parámetros`)
| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_umbral_minimo` | `int` | No | Default `3`; mínimo efectivo `1`. Oculta colonias con menos de ese número de expedientes + alertas, para no exponer casos identificables. |

## 2. Salida
Una fila por asentamiento que alcanza el umbral, ordenada por `total_expedientes + total_alertas` descendente y luego por nombre.

| Columna | Tipo | Descripción |
|---|---|---|
| `asentamiento_id` | `integer` | ID en `cat_asentamiento`. |
| `codigo_postal` | `text` | CP. |
| `nombre`, `tipo_asentamiento`, `municipio`, `estado` | `text` | Datos de la colonia. |
| `latitud`, `longitud` | `numeric(9,6)` | Coordenadas para el mapa. |
| `total_expedientes` | `bigint` | Fichas activas con domicilio actual en la colonia. |
| `total_alertas` | `bigint` | Alertas activas en la colonia. |
| `total_actividades` | `bigint` | Actividades preventivas activas en la colonia (no cuenta para el umbral). |

## 3. Reglas ABAC y RLS
- `security definer`: solo devuelve conteos agregados, nunca datos de personas.
- Cuenta solo registros `activo`; el expediente cuenta por su domicilio `es_actual`.

## 4. Errores esperados
| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Sin permiso `expediente.ver` (Recepción, UMECA, app). |

## 5. Llamada
```ts
const { data, error } = await supabase
  .rpc('get_mapa_calor_asentamiento', { p_umbral_minimo: 3 });
```
