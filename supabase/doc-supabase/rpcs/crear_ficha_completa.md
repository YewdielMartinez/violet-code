# `crear_ficha_completa`

- **Versión:** [`20261128001800_60`](../../migrations/20261128001800_60_integrar_develop_y_supabase.sql)
- **Migración:** [`20261128001700_59_casillas_sin_dato.sql`](../../migrations/20261128001700_59_casillas_sin_dato.sql) *(actualiza `_10_`, `_11_`, `_12_`, `_13_`, `_18_`, `_57_`, `_58_`)*
- **Permiso RBAC:** `tiene_permiso('expediente.escribir')`
- **Actores autorizados:** `titular`, `subdireccion`, `trabajo_social`.

## 1. Entrada (`p_payload jsonb`)
Objeto con tres secciones:
- `identidad`: `curp`, `nombres`, `apellidoPaterno`, `apellidoMaterno`, `celular`, `escolaridad`, `discapacidad`, `grupoEtnico`, `religion`, `estadoCivil`, `ocupacionId`, `ocupacionOtra`, `tieneTrabajo` (`boolean | null`), `numeroHijas` (`number | null`), `numeroHijosHombres` (`number | null`), `servicioMedico`, `servicioMedicoOtro`, `tieneEmbarazo` (`boolean | null`), `tieneDenuncia` (`boolean | null`), `esVictimaDelito` (`boolean | null`), `drogas` (`tipo_droga[]`; `'no_consume'` es exclusivo), `especificacionDroga` (solo cuando hay consumo distinto de `'no_consume'`), `consumoAlcohol` (`'no_consume' | 'ocasional' | 'frecuente'`), `serviciosSolicitadosAreaIds` (opcional; puede omitirse, ser `null` o `[]`), `avisoPrivacidadAceptado` (`true`). Omisión o vacío en casillas e hijos se guarda como `null` ("sin dato", nunca `false` ni `0`).
- `domicilio`: `asentamientoId` o `codigoPostalForaneo`, `calle`, `numeroExterior`, `numeroInterior`, `referencias`, `zona`.
- `estudio`: `ingresoMensualPropio`, `numeroDependientes`, `tieneApoyo`, `especificacionApoyo`, `tipoVivienda`, `material`, `materialOtro`, `servicios` (`servicio_vivienda[]`), `bienes` (`bien_vivienda[]`), `aportantes[]` (`nombre` opcional; si se envía no vacío, máximo 150 caracteres).

## 2. Salida
| Columna | Tipo | Descripción |
|---|---|---|
| `ficha_id` | `uuid` | ID de la ficha creada o reutilizada. |
| `folio` | `text` | Folio `SEM-AAAA-NNNN`. |
| `persona_id` | `uuid` | ID de la persona atendida. |

## 3. Reglas ABAC y efectos secundarios
- Nunca ejecuta `DELETE` físico sobre `ficha_registro`: si encuentra una ficha trunca sin estudio ni registros hijos, la reutiliza con `UPDATE` para conservar trazabilidad en `bitacora_acceso`.
- Si la CURP ya cuenta con expediente completo (con estudio o registros hijos), rechaza con `23505` sin borrar nada.

## 4. Errores esperados
| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Actor sin permiso `expediente.escribir`. |
| `23514` | Aviso de privacidad no aceptado, `'no_consume'` combinado con otras drogas, `especificacionDroga` sin consumo o tipo inválido en `serviciosSolicitadosAreaIds` / `drogas`. |
| `23505` | La CURP ya cuenta con un expediente registrado. |
