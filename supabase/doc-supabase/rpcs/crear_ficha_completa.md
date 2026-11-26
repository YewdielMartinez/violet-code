# `crear_ficha_completa`

- **Migración:** [`20261126000800_18_rpc_detalle_y_archivo.sql`](../../migrations/20261126000800_18_rpc_detalle_y_archivo.sql) *(actualiza `_10_`, `_11_`, `_12_`, `_13_`)*
- **Permiso RBAC:** `tiene_permiso('expediente.escribir')`
- **Actores autorizados:** `titular`, `subdireccion`, `trabajo_social`.

## 1. Entrada (`p_payload jsonb`)
Objeto con tres secciones:
- `identidad`: `curp`, `nombres`, `apellidoPaterno`, `apellidoMaterno`, `celular`, `escolaridad`, `discapacidad`, `grupoEtnico`, `religion`, `estadoCivil`, `ocupacionId`, `ocupacionOtra`, `tieneTrabajo`, `numeroHijas`, `numeroHijosHombres`, `servicioMedico`, `servicioMedicoOtro`, `tieneEmbarazo`, `tieneDenuncia`, `esVictimaDelito`, `tieneConsumoDroga`, `drogas` (`tipo_droga[]`), `especificacionDroga`, `tieneConsumoAlcohol`, `serviciosSolicitadosAreaIds` (no vacío), `avisoPrivacidadAceptado` (`true`).
- `domicilio`: `asentamientoId` o `codigoPostalForaneo`, `calle`, `numeroExterior`, `numeroInterior`, `referencias`, `zona`.
- `estudio`: `ingresoMensualPropio`, `numeroDependientes`, `tieneApoyo`, `especificacionApoyo`, `tipoVivienda`, `material`, `materialOtro`, `servicios` (`servicio_vivienda[]`), `bienes` (`bien_vivienda[]`), `aportantes[]`.

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
| `23514` | Aviso de privacidad no aceptado o sin servicios solicitados. |
| `23505` | La CURP ya cuenta con un expediente registrado. |
