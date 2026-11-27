# Derivaciones (canalizaciones)

[← Índice](./README.md) · Errores: [errores.md](./errores.md)

Estados: `pendiente → en_proceso → concluida`, y `cancelada` desde `pendiente` o `en_proceso`.

Destinos (`destino`): `trabajo_social`, `psicologia`, `juridico` (internos, llevan `area_destino_id`), `fiscalia`, `refugio`, `capacitacion`, `otra_institucion` (externos, llevan `institucion_id` del directorio o `institucion_otra`).

> La creación de canalizaciones se hace únicamente mediante [`crear_canalizacion`](#crear_canalizacion) (solo Trabajo Social). El `insert` directo sobre `derivacion` está bloqueado en RLS (`42501`). El trigger `validar_derivacion_area` sigue validando que `area_destino_id` corresponda al `destino` y que Psicología y Jurídico solo reciban mayores de 18 años (RN-01); ambos dan `23514`.

**Alcance por rol**

| Rol             | Crea                      | Ve y gestiona                          |
| --------------- | ------------------------- | -------------------------------------- |
| TS              | Sí (`crear_canalizacion`) | Todas                                  |
| Tit, Sub        | No (`42501`)              | Todas                                  |
| Psi, Jur        | No (`42501`)              | Solo donde su área es origen o destino |
| Rec, UMECA, app | No (`42501`)              | Nada (`42501`)                         |

---

## `crear_canalizacion`

**Versión:** [`20261127000200_33`](../../migrations/20261127000200_33_rpc_crear_canalizacion.sql)

> Crea una canalización interna o externa desde el área de Trabajo Social (`area_origen_id` se toma de la sesión).

| Permiso              | Roles | Tipo      | Bitácora        | Migración                    |
| -------------------- | ----- | --------- | --------------- | ---------------------------- |
| `canalizacion.crear` | TS    | Escritura | Sí, por trigger | `_33_rpc_crear_canalizacion` |

**Llamada**

```ts
const { data, error } = await supabase
  .rpc("crear_canalizacion", {
    p_ficha_id: fichaId,
    p_destino: "psicologia",
    p_area_destino_id: areaPsicologiaId,
    p_motivo: "Valoración psicológica inicial",
  })
  .single();
// data: { derivacion_id, estado, aviso }
```

**Parámetros**

| Parámetro            | Tipo                | Obligatorio                                  | Regla                                                                                                                       |
| -------------------- | ------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `p_ficha_id`         | `string`            | Sí                                           | Expediente activo y no archivado (`23514`).                                                                                 |
| `p_destino`          | `DestinoDerivacion` | Sí                                           | Interno (`trabajo_social`, `psicologia`, `juridico`) o externo (`fiscalia`, `refugio`, `capacitacion`, `otra_institucion`). |
| `p_area_destino_id`  | `number \| null`    | Si destino es interno                        | Debe corresponder al `p_destino`; `null` si destino es externo.                                                             |
| `p_institucion_id`   | `number \| null`    | No                                           | Solo externos; mutua exclusión con `p_institucion_otra`.                                                                    |
| `p_institucion_otra` | `string \| null`    | Si `otra_institucion` sin `p_institucion_id` | Máx. 200 caracteres; solo externos.                                                                                         |
| `p_motivo`           | `string \| null`    | No                                           | Máx. 1000 caracteres.                                                                                                       |

**Respuesta**

```ts
interface CrearCanalizacionResult {
  derivacion_id: string;
  estado: EstadoDerivacion; // 'pendiente'
  aviso: string | null; // Aviso RN-03 si sexo = 'H' en destino interno no jurídico
}
```

**Errores**

| Código  | Cuándo                                                                                | Mensaje UI      |
| ------- | ------------------------------------------------------------------------------------- | --------------- |
| `42501` | Actor distinto de `trabajo_social` activo                                             | Fijo de permiso |
| `23514` | Expediente archivado/inexistente, destino inválido o menor de edad en Psi/Jur (RN-01) | `error.message` |

---

## `get_derivaciones`

**Versión:** [`20261127000300_34`](../../migrations/20261127000300_34_historial_canalizaciones.sql)

> Lista de derivaciones, de un expediente o de todos, filtrada por lo que el rol puede ver.

| Permiso | Roles | Tipo | Bitácora | Migración |
| --- | --- | --- | --- | --- |
| `derivacion.gestionar` + área | Tit, Sub, TS, Psi, Jur | Lectura | No | `_34_historial_canalizaciones` (`_25_`) |

**Llamada**

```ts
const { data, error } = await supabase.rpc("get_derivaciones", {
  p_ficha_id: fichaId, // null = todas las que puedes ver
  p_estado: null,
  p_limite: 200,
});
```

**Parámetros**

| Parámetro    | Tipo                       | Obligatorio | Regla                  |
| ------------ | -------------------------- | ----------- | ---------------------- |
| `p_ficha_id` | `string \| null`           | No          | Filtra un expediente.  |
| `p_estado`   | `EstadoDerivacion \| null` | No          | Filtra un estado.      |
| `p_limite`   | `number`                   | No          | `1..200`, default 200. |

**Respuesta** (arreglo, más recientes primero)

```ts
interface DerivacionRow {
  id: string;
  ficha_id: string;
  folio: string;
  usuaria_nombre: string;
  area_origen_id: number | null;
  area_origen_nombre: string | null;
  area_destino_id: number | null;
  area_destino_nombre: string | null;
  institucion_id: number | null;
  institucion_nombre: string | null;
  institucion_otra: string | null;
  destino: DestinoDerivacion;
  motivo: string | null;
  fecha_derivacion: string; // 'YYYY-MM-DD'
  estado: EstadoDerivacion;
  creado_en: string;
}
```

**Errores**

| Código  | Cuándo                       | Mensaje UI            |
| ------- | ---------------------------- | --------------------- |
| `42501` | Rec, UMECA, app, inactivo    | Vista de "sin acceso" |
| `23514` | `p_limite` fuera de `1..200` | `error.message`       |

**En el front:** `SupabaseDerivacionRepository` (hoy lee la tabla con `.from()`; cambiar a esta RPC) · hook en `canalizaciones/api.ts`.

---

## `cambiar_estado_derivacion`

**Versión:** [`20261127000300_34`](../../migrations/20261127000300_34_historial_canalizaciones.sql)

> Avanza o cancela una derivación respetando las transiciones y registra el evento en `canalizacion_evento`.

| Permiso | Roles | Tipo | Bitácora | Migración |
| --- | --- | --- | --- | --- |
| `derivacion.gestionar` + área | Tit, Sub, TS, Psi, Jur | Escritura | Sí, por trigger + `canalizacion_evento` | `_34_historial_canalizaciones` (`_25_`) |

**Llamada**

```ts
const { data, error } = await supabase
  .rpc("cambiar_estado_derivacion", {
    p_derivacion_id: id,
    p_estado: "concluida",
    p_nota: "Valoración psicológica concluida.", // obligatoria en 'concluida' y 'cancelada'
  })
  .single();
// data: { derivacion_id, estado, actualizado_en }
```

**Transiciones válidas**

| Desde | Hacia | Nota (`p_nota`) |
| --- | --- | --- |
| `pendiente` | `en_proceso` | Opcional |
| `pendiente` | `cancelada` | Obligatoria (`23514`) |
| `en_proceso` | `concluida`, `cancelada` | Obligatoria (`23514`) |

**Errores**

| Código | Cuándo | Mensaje UI |
| --- | --- | --- |
| `42501` | Rol sin permiso, o Psi/Jur sobre una derivación ajena a su área | Fijo de permiso |
| `23514` | Parámetros nulos, falta `p_nota` al concluir/cancelar, derivación inexistente o transición no permitida | `error.message` |

**En el front:** `DerivacionRepository.updateEstado` · `canalizaciones/useUpdateEstadoDerivacion` (ya existe; cambiar la implementación del adaptador a esta RPC).

---

## `get_historial_canalizaciones`

**Versión:** [`20261127000300_34`](../../migrations/20261127000300_34_historial_canalizaciones.sql)

> Lista todas las canalizaciones activas de un expediente con su arreglo cronológico de eventos (`canalizacion_evento`).

| Permiso | Roles | Tipo | Bitácora | Migración |
| --- | --- | --- | --- | --- |
| `derivacion.gestionar` + área | Tit, Sub, TS, Psi, Jur | Lectura | No | `_34_historial_canalizaciones` |

**Llamada**

```ts
const { data, error } = await supabase.rpc("get_historial_canalizaciones", {
  p_ficha_id: fichaId,
});
```

**Respuesta** (arreglo, canalizaciones más recientes primero; `eventos` más antiguos primero)

```ts
interface CanalizacionEvento {
  id: string;
  estado_anterior: EstadoDerivacion | null;
  estado_nuevo: EstadoDerivacion;
  nota: string | null;
  creado_por: string | null;
  creado_por_nombre: string | null;
  creado_en: string;
}

interface HistorialCanalizacionRow {
  id: string;
  ficha_id: string;
  area_origen_id: number | null;
  area_origen_nombre: string | null;
  area_destino_id: number | null;
  area_destino_nombre: string | null;
  institucion_id: number | null;
  institucion_nombre: string | null;
  institucion_otra: string | null;
  destino: DestinoDerivacion;
  motivo: string | null;
  fecha_derivacion: string;
  estado: EstadoDerivacion;
  creado_en: string;
  actualizado_en: string;
  eventos: CanalizacionEvento[];
}
```

**Errores**

| Código | Cuándo | Mensaje UI |
| --- | --- | --- |
| `42501` | Rol sin `derivacion.gestionar` | Vista de "sin acceso" |
| `23514` | `p_ficha_id` nulo o expediente inexistente/inactivo | `error.message` |
