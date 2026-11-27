# Expedientes

[← Índice](./README.md) · Errores: [errores.md](./errores.md)

Flujo típico: **verificar CURP** → (si es nueva) **crear ficha** → **abrir detalle** → **línea de tiempo**. Para buscar en todo el historial se usa `buscar_expedientes`.

---

## `verificar_curp`

> Una sola llamada para el diálogo "Verificar CURP": dice si la persona ya tiene expediente, si existe sin ficha, si se pre-registró en la app o si es nueva.

| Permiso                     | Roles                       | Tipo    | Bitácora                                        | Migración                      |
| --------------------------- | --------------------------- | ------- | ----------------------------------------------- | ------------------------------ |
| `expediente.verificar_curp` | Todos los empleados activos | Lectura | Sí: `'ver'` sobre `persona` cuando la encuentra | `_17_rpc_busqueda_expedientes` |

**Llamada**

```ts
const { data, error } = await supabase
  .rpc("verificar_curp", { p_curp: curp.trim().toUpperCase() })
  .single();
```

**Parámetros**

| Parámetro | Tipo     | Obligatorio | Regla                                                                        |
| --------- | -------- | ----------- | ---------------------------------------------------------------------------- |
| `p_curp`  | `string` | Sí          | CURP oficial de 18 caracteres. La RPC la pasa a mayúsculas y quita espacios. |

**Respuesta** (siempre 1 fila)

```ts
type VerificarCurpRow =
  | {
      resultado: "expediente_existente";
      persona_id: string;
      ficha_id: string | null;
      folio: string;
      estado: EstadoFicha | null;
      nombre_completo: string;
      pre_registro_id: null;
    }
  | {
      resultado: "persona_sin_ficha";
      persona_id: string;
      ficha_id: null;
      folio: null;
      estado: null;
      nombre_completo: string;
      pre_registro_id: null;
    }
  | {
      resultado: "pre_registro_movil";
      persona_id: null;
      ficha_id: null;
      folio: null;
      estado: null;
      nombre_completo: string;
      pre_registro_id: string;
    }
  | {
      resultado: "nuevo";
      persona_id: null;
      ficha_id: null;
      folio: null;
      estado: null;
      nombre_completo: null;
      pre_registro_id: null;
    };
```

Ejemplo:

```json
{
  "resultado": "expediente_existente",
  "persona_id": "3333…11",
  "ficha_id": "5555…11",
  "folio": "SEM-2026-0091",
  "estado": "abierto",
  "nombre_completo": "Lucía Fernanda Álvarez Méndez",
  "pre_registro_id": null
}
```

**Comportamiento**

- Busca primero en `persona` (activa). Si tiene ficha activa, devuelve la más reciente.
- **Recepción** recibe salida reducida: en `expediente_existente` vienen `ficha_id = null` y `estado = null` (sí ve folio y nombre, que necesita para agendar). Nunca recibe `pre_registro_movil`: en ese caso le llega `nuevo`.
- `pre_registro_movil` solo sale para quien tiene `expediente.escribir` (Tit, Sub, TS). Psicología y Jurídico reciben `nuevo` en ese caso.
- Con `pre_registro_movil`, el siguiente paso es `buscar_pre_registro_por_curp` para precargar el formulario.

**Errores**

| Código  | Cuándo                                          | Mensaje UI                                             |
| ------- | ----------------------------------------------- | ------------------------------------------------------ |
| `42501` | Sin sesión, inactivo, UMECA o usuaria de la app | Fijo de permiso                                        |
| `23514` | La CURP no tiene formato válido                 | `error.message` ("La CURP no tiene un formato válido") |

**En el front:** `SupabaseExpedienteRepository.verifyByCurp` (hoy hace un join REST; cambiar a esta RPC) · hook `expedientes/useVerifyCurp`.

---

## `buscar_expedientes`

> Busca en todo el historial por CURP, folio o nombre, sin bajar todas las fichas al navegador.

| Permiso          | Roles                  | Tipo    | Bitácora | Migración                      |
| ---------------- | ---------------------- | ------- | -------- | ------------------------------ |
| `expediente.ver` | Tit, Sub, TS, Psi, Jur | Lectura | No       | `_17_rpc_busqueda_expedientes` |

**Llamada**

```ts
const { data, error } = await supabase.rpc("buscar_expedientes", {
  p_termino: "lucia alvarez",
  p_limite: 20,
  p_incluir_archivados: false,
});
```

**Parámetros**

| Parámetro              | Tipo      | Obligatorio | Regla                                                                                                                                    |
| ---------------------- | --------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `p_termino`            | `string`  | Sí          | Mínimo 3 caracteres. Se detecta el tipo: 18 caracteres alfanuméricos = CURP exacta; empieza con `SEM-` = folio (prefijo); otro = nombre. |
| `p_limite`             | `number`  | No          | Default 20. Se ajusta solo a `1..100` (no da error).                                                                                     |
| `p_incluir_archivados` | `boolean` | No          | Default `false`.                                                                                                                         |

**Respuesta** (arreglo)

```ts
interface BuscarExpedientesRow {
  ficha_id: string;
  folio: string;
  estado: EstadoFicha;
  persona_id: string;
  curp: string;
  nombre_completo: string;
  sexo: "H" | "M";
  fecha_nacimiento: string; // 'YYYY-MM-DD'
  en_lista_urgencias: boolean;
  coincidencia: "curp" | "folio" | "nombre";
  similitud: number; // 1.0 en CURP/folio; 0..1 en nombre
}
```

**Comportamiento**

- Por nombre ignora acentos y mayúsculas ("lucia alvarez" encuentra "Lucía Álvarez"). Ordena por `similitud` y luego por fecha de registro.
- Solo fichas y personas activas. Sin `p_incluir_archivados`, excluye `archivado`.
- Hoy no usa índice para nombre (lee la tabla). Para el volumen del proyecto no importa.

**Errores**

| Código  | Cuándo                            | Mensaje UI                                                  |
| ------- | --------------------------------- | ----------------------------------------------------------- |
| `42501` | Recepción, UMECA, app, inactivo   | Fijo de permiso                                             |
| `23514` | Término con menos de 3 caracteres | `error.message`. Mejor: no llamar hasta tener 3 caracteres. |

**En el front:** `SupabaseExpedienteRepository.list(query)` (hoy trae 200 fichas y filtra en el navegador) · hook `expedientes/useExpedientes` · `queryKey ['expedientes','list',q]`. Usa _debounce_ de 300 ms en el buscador.

---

## `buscar_pre_registro_por_curp`

> Trae lo que la usuaria capturó en la app para precargar la Ficha Única.

| Permiso               | Roles        | Tipo    | Bitácora | Migración                                   |
| --------------------- | ------------ | ------- | -------- | ------------------------------------------- |
| `expediente.escribir` | Tit, Sub, TS | Lectura | No       | `_06_reglas_negocio`, actualizada en `_17_` |

**Llamada**

```ts
const { data, error } = await supabase
  .rpc("buscar_pre_registro_por_curp", { p_curp: curp })
  .maybeSingle();
```

**Respuesta** (0 o 1 fila)

```ts
interface PreRegistroRow {
  pre_registro_id: string;
  curp: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  sexo: "H" | "M"; // calculado desde la CURP
  fecha_nacimiento: string; // calculada desde la CURP
  entidad_nacimiento: string; // clave de 2 letras
  celular: string | null;
  persona_id: string | null; // si ya se ligó por CURP
}
```

**Errores:** `42501` para cualquier otro rol (mensaje fijo).

**En el front:** ya se usa en `SupabaseExpedienteRepository` (`BannerPrecargaMovil`). Cuando `verifyByCurp` pase a `verificar_curp`, solo se llama si el resultado es `pre_registro_movil`.

---

## `crear_ficha_completa`

> Alta atómica de la Ficha Única: persona, ficha, servicios solicitados, domicilio y estudio socioeconómico. Si algo falla, no se guarda nada.

| Permiso               | Roles        | Tipo      | Bitácora                     | Migración                        |
| --------------------- | ------------ | --------- | ---------------------------- | -------------------------------- |
| `expediente.escribir` | Tit, Sub, TS | Escritura | Sí, por triggers (`'crear'`) | `_10_`, actualizada hasta `_58_` |

**Llamada**

```ts
const { data, error } = await supabase
  .rpc("crear_ficha_completa", { p_payload: payload })
  .single();
// data: { ficha_id, folio, persona_id }
```

**`p_payload`** (claves en camelCase dentro del JSON)

```ts
interface CrearFichaPayload {
  identidad: {
    existingPersonaId?: string | null; // si verificar_curp devolvió persona_sin_ficha
    curp: string;
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno?: string | null;
    celular?: string | null;
    escolaridad?: EscolaridadNivel | null;
    discapacidad?: string | null;
    grupoEtnico?: string | null;
    religion?: string | null;
    estadoCivil?: EstadoCivil | null;
    ocupacionId?: number | null;
    ocupacionOtra?: string | null;
    tieneTrabajo?: boolean | null;
    numeroHijas?: number;
    numeroHijosHombres?: number;
    servicioMedico?: ServicioMedico | null;
    servicioMedicoOtro?: string | null;
    tieneEmbarazo?: boolean | null;
    tieneDenuncia?: boolean | null;
    esVictimaDelito?: boolean | null;
    drogas?: TipoDroga[];
    especificacionDroga?: string | null; // 'no_consume' es exclusivo
    consumoAlcohol?: ConsumoAlcohol | null; // 'no_consume' | 'ocasional' | 'frecuente'
    serviciosSolicitadosAreaIds?: number[]; // opcional (omitido, null o [])
    avisoPrivacidadAceptado: true; // obligatorio
  };
  domicilio: {
    asentamientoId?: number | null;
    codigoPostalForaneo?: string | null;
    calle?: string | null;
    numeroExterior?: string | null;
    numeroInterior?: string | null;
    referencias?: string | null;
    zona?: "urbana" | "rural" | null;
  };
  estudio: {
    ingresoMensualPropio?: number | null;
    numeroDependientes?: number | null;
    tieneApoyo?: boolean | null;
    especificacionApoyo?: string | null;
    tipoVivienda?: TipoVivienda | null;
    material?: MaterialVivienda | null;
    materialOtro?: string | null;
    servicios?: ServicioVivienda[]; // 'agua' | 'drenaje' | 'luz' | 'pavimento' | 'cable' | 'internet'
    bienes?: BienVivienda[]; // 'estufa' | 'refrigerador' | 'lavadora' | ...
    aportantes?: Array<{
      nombre: string;
      parentescoId?: number | null;
      parentescoOtro?: string | null;
      ocupacionId?: number | null;
      ocupacionOtra?: string | null;
      tipoTrabajo?: "fijo" | "temporal" | "negocio_propio" | null;
      monto?: number | null;
      frecuencia?: FrecuenciaIngreso | null;
    }>;
  };
}
```

**Comportamiento**

- Resuelve la persona por `existingPersonaId` o por CURP; si no existe, la crea.
- Si la persona ya tiene una ficha "trunca" (sin estudio ni registros hijos) la **reutiliza** con `update`; nunca borra.
- El folio `SEM-AAAA-NNNN` lo genera la base.
- Si había un `pre_registro` con la misma CURP, el trigger lo liga a la persona.

**Errores**

| Código  | Cuándo                                                                             | Mensaje UI                                                   |
| ------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `42501` | Psi, Jur, Rec, UMECA, app                                                          | Fijo de permiso                                              |
| `23514` | Aviso de privacidad no aceptado; sin servicios solicitados; dato fuera de catálogo | `error.message`                                              |
| `23505` | La CURP ya tiene expediente completo                                               | `error.message` (trae el folio). Ofrecer "Abrir expediente". |

**En el front:** ya se usa en `SupabaseFichaRepository` (mapper de camelCase existente).

---

## `get_expediente_detalle`

> Todo lo que la pantalla de expediente necesita en un solo objeto.

| Permiso          | Roles                  | Tipo    | Bitácora                                                     | Migración                     |
| ---------------- | ---------------------- | ------- | ------------------------------------------------------------ | ----------------------------- |
| `expediente.ver` | Tit, Sub, TS, Psi, Jur | Lectura | Sí: `'ver'` sobre `ficha_registro` (y `agresor` si se piden) | `_18_`, actualizada en `_58_` |

**Llamada**

```ts
const { data, error } = await supabase.rpc("get_expediente_detalle", {
  p_ficha_id: fichaId,
  p_incluir_agresores: false,
});
// data es un objeto (jsonb), no un arreglo
```

**Respuesta**

```ts
interface ExpedienteDetalle {
  ficha: {
    id: string;
    folio: string;
    estado: EstadoFicha;
    registrada_en: string;
    aviso_privacidad_aceptado_en: string;
    estado_civil: EstadoCivil | null;
    ocupacion_id: number | null;
    ocupacion_nombre: string | null;
    ocupacion_otra: string | null;
    tiene_trabajo: boolean | null;
    servicio_medico: ServicioMedico | null;
    servicio_medico_otro: string | null;
    numero_hijas: number;
    numero_hijos_hombres: number;
    tiene_embarazo: boolean | null;
    tiene_denuncia: boolean | null;
    es_victima_delito: boolean | null;
    drogas: TipoDroga[] | null;
    especificacion_droga: string | null;
    consumo_alcohol: ConsumoAlcohol | null;
  };
  persona: {
    id: string;
    curp: string;
    nombres: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    sexo: "H" | "M";
    fecha_nacimiento: string;
    entidad_nacimiento: string;
    celular: string | null;
    escolaridad: EscolaridadNivel | null;
    discapacidad: string | null;
    religion: string | null;
    grupo_etnico: string | null;
  };
  servicios_solicitados: Array<{
    area_id: number;
    clave: string;
    nombre: string;
  }>;
  domicilio_actual: {
    id: string;
    asentamiento_id: number | null;
    asentamiento_nombre: string | null;
    codigo_postal: string | null;
    calle: string | null;
    numero_exterior: string | null;
    numero_interior: string | null;
    referencias: string | null;
    zona: "urbana" | "rural" | null;
  } | null;
  estudio_actual: {
    id: string;
    fecha_estudio: string;
    ingreso_mensual_propio: number | null;
    numero_dependientes: number | null;
    tiene_apoyo: boolean | null;
    especificacion_apoyo: string | null;
    tipo_vivienda: TipoVivienda | null;
    material: MaterialVivienda | null;
    material_otro: string | null;
    servicios: ServicioVivienda[] | null;
    bienes: BienVivienda[] | null;
    aportantes: Array<{
      id: string;
      nombre: string;
      parentesco_id: number | null;
      parentesco_nombre: string | null;
      parentesco_otro: string | null;
      ocupacion_id: number | null;
      ocupacion_nombre: string | null;
      ocupacion_otra: string | null;
      tipo_trabajo: TipoTrabajo | null;
      monto: number | null;
      frecuencia: FrecuenciaIngreso | null;
    }>;
  } | null;
  orden_vigente: boolean;
  citas_hoy: Array<{
    cita_id: string;
    programada_en: string;
    estado: EstadoCita;
    area_clave: string;
  }>;
  agresores?: Array<Record<string, unknown>>; // filas completas de `agresor`; solo con p_incluir_agresores
}
```

**Comportamiento**

- `citas_hoy` usa el día de `America/Mazatlan` y aplica el filtro de agenda del rol: Dirección ve todas, TS ve TS y Psicología, Psicología y Jurídico solo su área.
- No incluye `nota_area` ni `historial_clinico`: esos se leen aparte (ver [tablas-directas.md](./tablas-directas.md)).
- Cada llamada deja un `'ver'` en bitácora. No la llames en bucle; usa `staleTime` en TanStack Query.

**Errores**

| Código  | Cuándo                                               | Mensaje UI                                              |
| ------- | ---------------------------------------------------- | ------------------------------------------------------- |
| `42501` | Recepción, UMECA, app, inactivo                      | Vista de "sin acceso"                                   |
| `23514` | `p_ficha_id` nulo, expediente inexistente o inactivo | `error.message` ("Expediente no encontrado o inactivo") |

**En el front:** `SupabaseFichaRepository.getDetail` (cambiar implementación) · hook `expedientes/useFichaDetail` · `queryKey ['expedientes','detail',id]`.

---

## `archivar_ficha`

> Pasa un expediente a `archivado` cuando ya no tiene nada pendiente, guardando motivo, fecha y responsable.

| Permiso               | Roles        | Tipo      | Bitácora                         | Migración                         |
| --------------------- | ------------ | --------- | -------------------------------- | --------------------------------- |
| `expediente.escribir` | Tit, Sub, TS | Escritura | Sí, por trigger (`'actualizar'`) | `_38_archivar_y_reabrir` (`_18_`) |

**Llamada**

```ts
const { data, error } = await supabase
  .rpc("archivar_ficha", { p_ficha_id: fichaId, p_motivo: "Caso concluido" })
  .single();
// data: { ficha_id, estado: 'archivado', actualizado_en }
```

**Comportamiento**

- Solo desde `abierto`, `en_seguimiento` o `cerrado`.
- `p_motivo` es obligatorio (1..1000 caracteres); guarda `motivo_archivo`, `archivada_en` y `archivada_por`.
- Rechaza si hay citas futuras `agendada`/`confirmada` o alertas `nueva`/`tomada`.

**Errores**

| Código  | Cuándo                                                                              | Mensaje UI                              |
| ------- | ----------------------------------------------------------------------------------- | --------------------------------------- |
| `42501` | Psi, Jur, Rec, UMECA                                                                | Fijo de permiso                         |
| `23514` | `p_motivo` vacío/largo, inexistente, ya archivado, citas futuras o alertas abiertas | `error.message` (dice cuál es la causa) |

**En el front:** `SupabaseFichaRepository.archive` (`features/expedientes/api.ts`) actualmente llama sin `p_motivo` y la pantalla debe solicitar motivo obligatorio (invalida `['expedientes','detail',id]` y `['expedientes','list']`).

---

## `reabrir_ficha`

> Reabre un expediente `archivado` guardando motivo, fecha y quién lo autoriza.

| Permiso              | Roles    | Tipo      | Bitácora                         | Migración                |
| -------------------- | -------- | --------- | -------------------------------- | ------------------------ |
| `expediente.reabrir` | Tit, Sub | Escritura | Sí, por trigger (`'actualizar'`) | `_38_archivar_y_reabrir` |

**Llamada**

```ts
const { data, error } = await supabase
  .rpc("reabrir_ficha", {
    p_ficha_id: fichaId,
    p_motivo: "Usuaria solicita reingreso",
  })
  .single();
// data: { ficha_id, estado: 'abierto' | 'en_seguimiento', actualizado_en }
```

**Comportamiento**

- Solo funciona desde `archivado`; si el expediente tiene atenciones activas pasa a `en_seguimiento`, si no pasa a `abierto`.
- `p_motivo` es obligatorio (1..1000 caracteres); guarda `motivo_reapertura`, `reabierta_en` y `reabierta_por` conservando `motivo_archivo`.

**Errores**

| Código  | Cuándo                                                  | Mensaje UI      |
| ------- | ------------------------------------------------------- | --------------- |
| `42501` | TS, Psi, Jur, Rec, UMECA                                | Fijo de permiso |
| `23514` | `p_motivo` vacío/largo, inexistente o no está archivado | `error.message` |

---

## `get_linea_tiempo`

> Historia del caso en orden cronológico: registro, citas, atenciones, derivaciones, órdenes de protección y alertas.

| Permiso          | Roles                  | Tipo    | Bitácora | Migración              |
| ---------------- | ---------------------- | ------- | -------- | ---------------------- |
| `expediente.ver` | Tit, Sub, TS, Psi, Jur | Lectura | No       | `_20_rpc_linea_tiempo` |

**Llamada**

```ts
const { data, error } = await supabase.rpc("get_linea_tiempo", {
  p_ficha_id: fichaId,
});
```

**Respuesta** (arreglo, de lo más nuevo a lo más viejo)

```ts
interface LineaTiempoRow {
  fecha: string;
  tipo:
    | "registro"
    | "cita"
    | "atencion"
    | "derivacion"
    | "orden_proteccion"
    | "alerta";
  area: string | null;
  titulo: string; // siempre visible
  detalle: string | null; // null si el evento no es del rol/área del actor
  referencia_id: string;
}
```

**Comportamiento**

- Dirección ve `detalle` de todo.
- TS, Psi y Jur ven `titulo` de todo, pero `detalle` solo de lo suyo: citas y atenciones de su área, derivaciones donde su área es origen o destino, órdenes de protección (TS y Jur) y alertas (línea 24/7).
- Nunca incluye `nota_area` ni `historial_clinico`.
- En la UI, cuando `detalle` es `null`, muestra el evento sin expandir (no como error).

**Errores:** `42501` (Recepción, UMECA, app) · `23514` (expediente nulo, inexistente o inactivo).

**En el front:** pendiente. Sugerido: `LineaTiempoRepository.obtener` · `expedientes/useLineaTiempo` · `queryKey ['linea-tiempo', fichaId]`.

---

## `registrar_consulta`

> Deja constancia de una lectura sensible que **no** pasó por una RPC (por ejemplo, abrir los datos de la persona agresora con `.from('agresor')`).

| Permiso                        | Roles                       | Tipo      | Bitácora       | Migración                    |
| ------------------------------ | --------------------------- | --------- | -------------- | ---------------------------- |
| Empleado activo o UMECA activo | Todos los empleados + UMECA | Escritura | Es la bitácora | `_03_`, endurecida en `_16_` |

**Llamada**

```ts
const { error } = await supabase.rpc("registrar_consulta", {
  p_tabla: "agresor",
  p_registro_id: agresorId,
});
```

**Parámetros**

| Parámetro       | Tipo                                                                                         | Regla                            |
| --------------- | -------------------------------------------------------------------------------------------- | -------------------------------- |
| `p_tabla`       | `'ficha_registro' \| 'agresor' \| 'persona' \| 'documento' \| 'historial_clinico' \| 'cita'` | Cualquier otro valor da `23514`. |
| `p_registro_id` | `string`                                                                                     | No vacío.                        |

**Respuesta:** `data = null`.

**Cuándo no usarla:** después de `get_expediente_detalle`, `verificar_curp`, `get_cola_alertas` o `get_umeca_citas`, que ya registran solas.

**Errores:** `42501` (sin sesión, inactivo) · `23514` (tabla no permitida o id vacío).

**En el front:** `SupabaseAgresorRepository.registrarConsulta` y `SupabaseExpedienteRepository.registerConsult`. Esta última quedará de sobra cuando el detalle use `get_expediente_detalle`.

---

## `actualizar_persona`

> Edita datos generales de una persona con bloqueo optimista y sin alterar CURP ni columnas calculadas.

| Permiso               | Roles        | Tipo      | Bitácora                       | Migración                        |
| --------------------- | ------------ | --------- | ------------------------------ | -------------------------------- |
| `expediente.escribir` | Tit, Sub, TS | Escritura | Sí, por trigger (`actualizar`) | `_35_rpc_editar_persona_y_ficha` |

**Llamada**

```ts
const { data, error } = await supabase
  .rpc("actualizar_persona", {
    p_persona_id: personaId,
    p_actualizado_en: personaActualizadoEn,
    p_celular: "6681234567",
    p_religion: "", // '' limpia el campo opcional; null lo conserva
  })
  .single();
```

**Reglas y errores**

- `null` conserva el campo; `''` borra opcionales (`apellido_materno`, `celular`, `discapacidad`, `grupo_etnico`, `religion`).
- `42501`: rol sin `expediente.escribir`.
- `23514`: expediente archivado (`"Reabre el expediente para editarlo"`), celular inválido o nombre/apellido vacío.
- `23505`: `p_actualizado_en` viejo (`"Este registro fue modificado por otra persona. Recarga los datos."`).

---

## `actualizar_ficha`

> Edita los datos de la Ficha Única y sus servicios solicitados con bloqueo optimista.

| Permiso               | Roles        | Tipo      | Bitácora                                            | Migración              |
| --------------------- | ------------ | --------- | --------------------------------------------------- | ---------------------- |
| `expediente.escribir` | Tit, Sub, TS | Escritura | Sí (`ficha_registro` + `ficha_servicio_solicitado`) | `_35_`, `_57_`, `_58_` |

**Llamada**

```ts
const { data, error } = await supabase
  .rpc("actualizar_ficha", {
    p_ficha_id: fichaId,
    p_actualizado_en: fichaActualizadoEn,
    p_estado_civil: "divorciado",
    p_servicios_solicitados_area_ids: [areaTsId, areaJurId],
  })
  .single();
```

**Reglas y errores**

- No modifica `folio`, `persona_id`, `estado`, `aviso_privacidad_aceptado_en`, `registrada_en` ni `activo`.
- Si se pasa `p_servicios_solicitados_area_ids` con áreas válidas, sincroniza y registra altas/bajas en `bitacora_acceso` (`ficha_servicio_solicitado`); `[]` los limpia todos y `null` los conserva.
- `p_drogas` acepta `TipoDroga[]` (`'no_consume'` es exclusivo) y `p_consumo_alcohol` usa `ConsumoAlcohol`.
- `42501`: rol sin `expediente.escribir`.
- `23514`: expediente archivado (`"Reabre el expediente para editarlo"`), área inexistente o inconsistencia de drogas/`servicio_medico_otro`.
- `23505`: `p_actualizado_en` viejo (`"Este registro fue modificado por otra persona. Recarga los datos."`).

---

## `guardar_agresor`

> Crea (`p_agresor_id = null`) o edita una persona agresora con bloqueo optimista y validaciones de parentesco/consumo/domicilio.

| Permiso           | Roles                  | Tipo      | Bitácora        | Migración              |
| ----------------- | ---------------------- | --------- | --------------- | ---------------------- |
| `agresor.acceder` | Tit, Sub, TS, Psi, Jur | Escritura | Sí, por trigger | `_36_`, `_57_`, `_58_` |

**Llamada**

```ts
const { data, error } = await supabase
  .rpc("guardar_agresor", {
    p_agresor_id: agresorId ?? null, // null = crear
    p_ficha_id: fichaId,
    p_actualizado_en: agresorActualizadoEn ?? null,
    p_nombres: "Roberto",
    p_parentesco_id: parentescoId,
  })
  .single();
```

**Errores:** `42501` (Recepción, UMECA, app) · `23514` (expediente archivado o validaciones de negocio) · `23505` (`p_actualizado_en` obsoleto).

---

## `desactivar_agresor`

> Realiza baja lógica (`activo = false`) de una persona agresora si no tiene orden de protección vigente ligada.

| Permiso           | Roles                  | Tipo      | Bitácora          | Migración                 |
| ----------------- | ---------------------- | --------- | ----------------- | ------------------------- |
| `agresor.acceder` | Tit, Sub, TS, Psi, Jur | Escritura | Sí (`desactivar`) | `_36_rpc_guardar_agresor` |

**Llamada**

```ts
const { data, error } = await supabase
  .rpc("desactivar_agresor", {
    p_agresor_id: agresorId,
    p_motivo: "Registro duplicado",
  })
  .single();
// data: { agresor_id, activo: false, actualizado_en }
```

**Errores:** `42501` (sin permiso) · `23514` (expediente archivado o tiene orden de protección vigente asociada).

---

## `guardar_historial_clinico` y `get_historial_clinico`

> Crea o actualiza el historial clínico psicológico del expediente (con bloqueo optimista y RN-01) y lo consulta dejando registro `'ver'` en bitácora.

| Permiso                     | Roles         | Tipo                | Bitácora                          | Migración                             |
| --------------------------- | ------------- | ------------------- | --------------------------------- | ------------------------------------- |
| `historial_clinico.acceder` | Tit, Sub, Psi | Lectura / Escritura | Sí (`ver`, `crear`, `actualizar`) | `_37_rpc_historial_clinico_y_estudio` |

**Llamada**

```ts
// Lectura (registra 'ver' automáticamente en bitácora)
const { data: historial } = await supabase
  .rpc("get_historial_clinico", { p_ficha_id: fichaId })
  .maybeSingle();

// Alta (p_actualizado_en = null) o edición (p_actualizado_en requerido)
const { data, error } = await supabase
  .rpc("guardar_historial_clinico", {
    p_ficha_id: fichaId,
    p_actualizado_en: historial?.actualizado_en ?? null,
    p_motivo_consulta: "Ansiedad derivada de violencia familiar",
    p_tiene_atencion_psicologica_previa: false,
  })
  .single();
```

**Errores:** `42501` (TS, Jur, Rec, UMECA) · `23514` (expediente archivado o persona menor de 18 años RN-01) · `23505` (`p_actualizado_en` obsoleto).

---

## `registrar_estudio_socioeconomico`

> Registra una nueva versión del estudio socioeconómico con sus aportantes (marcando el anterior como `es_actual = false`), o corrige el estudio de hoy si fue creado por la misma persona.

| Permiso               | Roles        | Tipo      | Bitácora        | Migración                             |
| --------------------- | ------------ | --------- | --------------- | ------------------------------------- |
| `expediente.escribir` | Tit, Sub, TS | Escritura | Sí, por trigger | `_37_rpc_historial_clinico_y_estudio` |

**Llamada**

```ts
const { data, error } = await supabase
  .rpc("registrar_estudio_socioeconomico", {
    p_ficha_id: fichaId,
    p_ingreso_mensual_propio: 7500,
    p_numero_dependientes: 2,
    p_tiene_apoyo: false,
    p_tipo_vivienda: "rentada",
    p_material: "block",
    p_aportantes: [
      { nombre: "Rosa Ruiz", monto: 2000, frecuencia: "quincenal" },
    ],
  })
  .single();
// data: { estudio_id, ficha_id, fecha_estudio, es_actual, fue_correccion, actualizado_en }
```

**Errores:** `42501` (Psi, Jur, Rec, UMECA) · `23514` (expediente archivado, apoyo/material inconsistentes o datos de aportantes inválidos).
