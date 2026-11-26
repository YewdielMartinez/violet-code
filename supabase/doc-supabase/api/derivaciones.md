# Derivaciones (canalizaciones)

[← Índice](./README.md) · Errores: [errores.md](./errores.md)

Estados: `pendiente → en_proceso → concluida`, y `cancelada` desde `pendiente` o `en_proceso`.

Destinos (`destino`): `trabajo_social`, `psicologia`, `juridico` (internos, llevan `area_destino_id`), `fiscalia`, `refugio`, `capacitacion`, `otra_institucion` (externos, llevan `institucion_id` del directorio o `institucion_otra`).

> Crear una derivación no tiene RPC: es un `insert` directo sobre `derivacion`. Ver [tablas-directas.md](./tablas-directas.md#derivacion). Un trigger valida que `area_destino_id` corresponda al `destino` y que Psicología y Jurídico solo reciban mayores de 18 años (RN-01); ambos dan `23514`.

**Alcance por rol**

| Rol | Ve y gestiona |
|---|---|
| Tit, Sub, TS | Todas |
| Psi, Jur | Solo donde su área es origen o destino |
| Rec, UMECA, app | Nada (`42501`) |

---

## `get_derivaciones`

> Lista de derivaciones, de un expediente o de todos, filtrada por lo que el rol puede ver.

| Permiso | Roles | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| Rol + área (valida en el SQL) | Tit, Sub, TS, Psi, Jur | Lectura | No | `_25_rpc_derivaciones` |

**Llamada**

```ts
const { data, error } = await supabase.rpc('get_derivaciones', {
  p_ficha_id: fichaId,   // null = todas las que puedes ver
  p_estado: null,
  p_limite: 200,
});
```

**Parámetros**

| Parámetro | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `p_ficha_id` | `string \| null` | No | Filtra un expediente. |
| `p_estado` | `EstadoDerivacion \| null` | No | Filtra un estado. |
| `p_limite` | `number` | No | `1..200`, default 200. |

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
  fecha_derivacion: string;   // 'YYYY-MM-DD'
  estado: EstadoDerivacion;
  creado_en: string;
}
```

**Errores**

| Código | Cuándo | Mensaje UI |
|---|---|---|
| `42501` | Rec, UMECA, app, inactivo | Vista de "sin acceso" |
| `23514` | `p_limite` fuera de `1..200` | `error.message` |

**En el front:** `SupabaseDerivacionRepository` (hoy lee la tabla con `.from()`; cambiar a esta RPC) · hook en `canalizaciones/api.ts`.

---

## `cambiar_estado_derivacion`

> Avanza o cancela una derivación respetando las transiciones.

| Permiso | Roles | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| Rol + área (valida en el SQL) | Tit, Sub, TS, Psi, Jur | Escritura | Sí, por trigger | `_25_rpc_derivaciones` |

**Llamada**

```ts
const { data, error } = await supabase
  .rpc('cambiar_estado_derivacion', { p_derivacion_id: id, p_estado: 'en_proceso' })
  .single();
// data: { derivacion_id, estado, actualizado_en }
```

**Transiciones válidas**

| Desde | Hacia |
|---|---|
| `pendiente` | `en_proceso`, `cancelada` |
| `en_proceso` | `concluida`, `cancelada` |

**Errores**

| Código | Cuándo | Mensaje UI |
|---|---|---|
| `42501` | Rol sin permiso, o Psi/Jur sobre una derivación ajena a su área | Fijo de permiso |
| `23514` | Parámetros nulos, derivación inexistente o transición no permitida | `error.message` |

**En el front:** `DerivacionRepository.updateEstado` · `canalizaciones/useUpdateEstadoDerivacion` (ya existe; cambiar la implementación del adaptador a esta RPC).
