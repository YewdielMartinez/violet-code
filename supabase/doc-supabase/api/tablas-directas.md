# Tablas que el front usa con `.from()`

[← Índice](./README.md) · Errores: [errores.md](./errores.md)

El estándar (§2) dice cuándo **no** hace falta RPC: catálogos y operaciones de una sola tabla sin joins. En esos casos el front usa `.from()` y la RLS decide qué puede hacer cada rol.

Reglas para todas:

- Columnas **explícitas** en el `select` (nunca `'*'`) y siempre `.limit(...)` en listas.
- Filtra `.eq('activo', true)`: no se borra nada, se desactiva.
- Si RLS no deja **ver**, la respuesta es `[]`, no error. Si no deja **escribir**, llega `42501`.
- Después de `insert`/`update`, usa `.select(...)` solo si el rol también puede leer esa tabla; si no, `42501`.
- Toda escritura queda en bitácora por trigger.

---

## Catálogos

| Tabla                | Para qué                                                  | Leer             | Escribir                         |
| -------------------- | --------------------------------------------------------- | ---------------- | -------------------------------- |
| `cat_area`           | Áreas (TS, Psicología, Jurídico, ...)                     | Cualquier sesión | `catalogos.gestionar` (Tit, Sub) |
| `cat_asentamiento`   | Colonias SEPOMEX con CP y coordenadas                     | Cualquier sesión | Tit, Sub                         |
| `cat_ocupacion`      | Ocupaciones                                               | Cualquier sesión | Tit, Sub                         |
| `cat_parentesco`     | Parentescos (agresor, aportantes)                         | Cualquier sesión | Tit, Sub                         |
| `cat_tipo_atencion`  | Tipos de atención por área (para `registrar_seguimiento`) | Cualquier sesión | Tit, Sub                         |
| `cat_tipo_actividad` | Tipos de actividad preventiva                             | Cualquier sesión | Tit, Sub                         |
| `cat_tipo_documento` | Tipos de documento                                        | Cualquier sesión | Tit, Sub                         |

```ts
const { data } = await supabase
  .from("cat_tipo_atencion")
  .select("id, clave, nombre, area_id")
  .eq("area_id", miAreaId)
  .order("nombre")
  .limit(100);
```

Los catálogos cambian poco: en TanStack Query usa `staleTime: Infinity` o de varias horas.

Las listas cerradas (estado civil, escolaridad, tipo de vivienda, estados de cita, etc.) **no** son tablas: son `enum` de Postgres. Sus valores salen de `Database['public']['Enums']` en los tipos generados.

## `directorio_institucion`

| Leer                                                               | Escribir                          |
| ------------------------------------------------------------------ | --------------------------------- |
| Empleados: todas (incluidas inactivas). UMECA y app: solo activas. | `directorio.gestionar` (Tit, Sub) |

Se usa para derivaciones externas (`institucion_id`) y en la app (directorio de apoyo).

---

## Tablas del expediente

| Tabla                                                                    | Leer                                       | Crear / editar                   | Nota                                                                                                                                                                  |
| ------------------------------------------------------------------------ | ------------------------------------------ | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `persona`                                                                | `expediente.ver` (Tit, Sub, TS, Psi, Jur)  | Solo RPC (`42501` directo)       | Alta por `crear_ficha_completa`; edición por `actualizar_persona` ([expedientes.md](./expedientes.md)).                                                               |
| `ficha_registro`                                                         | `expediente.ver`                           | Solo RPC (`42501` directo)       | Alta por `crear_ficha_completa`; edición/archivo/reapertura por `actualizar_ficha`, `archivar_ficha` y `reabrir_ficha`.                                               |
| `ficha_servicio_solicitado`, `estudio_socioeconomico`, `aportante_hogar` | `expediente.ver`                           | Solo RPC (`42501` directo)       | Alta en `crear_ficha_completa`; edición por `actualizar_ficha` y `registrar_estudio_socioeconomico` ([expedientes.md](./expedientes.md)).                             |
| `domicilio`                                                              | `expediente.ver`                           | Cerrado (`actualizar_domicilio`) | Usar el RPC [`actualizar_domicilio`](../rpcs/actualizar_domicilio.md); `insert`/`update` directos bloqueados (`42501`).                                               |
| `agresor`                                                                | `agresor.acceder` (Tit, Sub, TS, Psi, Jur) | Solo RPC (`42501` directo)       | Alta/edición/baja únicamente por `guardar_agresor` y `desactivar_agresor` ([expedientes.md](./expedientes.md)); al abrirlo llama `registrar_consulta('agresor', id)`. |
| `documento`                                                              | `expediente.ver`                           | `expediente.ver` + ficha no archivada | Ver [storage.md](./storage.md) (migración `63`: `42501` si está archivada). |

### `orden_proteccion`

| Leer             | Crear / editar                                                           |
| ---------------- | ------------------------------------------------------------------------ |
| `expediente.ver` | `orden_proteccion.escribir` + ficha no archivada (Tit, Sub, TS, Jur)     |

```ts
await supabase.from("orden_proteccion").insert({
  ficha_id,
  agresor_id, // agresor_id debe ser de la misma ficha
  numero_oficio,
  autoridad_emisora,
  fecha_emision: "2026-11-20", // date
  fecha_vigencia: "2027-02-20", // >= fecha_emision o null
  estado: "vigente", // 'vigente' | 'vencida' | 'cancelada' | 'en_tramite'
});
```

Al crear o cambiar una orden vigente, un trigger sube a `alta` las alertas `nueva` de esa persona.

### `historial_clinico`

| Leer                                        | Crear / editar             |
| ------------------------------------------- | -------------------------- |
| `historial_clinico.acceder` (Tit, Sub, Psi) | Solo RPC (`42501` directo) |

Una sola fila por ficha (`ficha_id` único). Para leer y guardar usa las RPC [`get_historial_clinico` y `guardar_historial_clinico`](./expedientes.md#guardar_historial_clinico-y-get_historial_clinico) (registran `'ver'` en bitácora, validan RN-01 y aplican bloqueo optimista).

### `nota_area`

| Leer                                                                           | Crear / editar                                      |
| ------------------------------------------------------------------------------ | --------------------------------------------------- |
| Dirección (`titular`, `subdireccion`) todas; `seguimiento.registrar` su área | `seguimiento.registrar` y **solo su área** (`42501` en Dirección) |

Notas privadas entre áreas (TS, Psi, Jur no ven las de otra área). Titular y Subdirección leen todas en solo lectura (`42501` si intentan insertar o actualizar). Para áreas de atención, `area_id` debe ser el del actor; si mandas otro, `42501`.

```ts
await supabase
  .from("nota_area")
  .insert({ ficha_id, area_id: miAreaId, contenido });
```

### `atencion`

> **Cerrada la escritura directa (`42501`, migración `43`):** usa [`registrar_seguimiento`](../rpcs/registrar_seguimiento.md) para altas y [`corregir_seguimiento`](../rpcs/corregir_seguimiento.md) para correcciones.

| Leer                                                  | Crear / editar             |
| ----------------------------------------------------- | -------------------------- |
| `expediente.ver`: Dirección todas; áreas solo la suya | Solo RPC (`42501` directo) |

Para leer contexto previo a una sesión usa [`get_contexto_seguimiento`](../rpcs/get_contexto_seguimiento.md) y para el historial usa [`get_linea_tiempo`](../rpcs/get_linea_tiempo.md).

---

## <a id="cita"></a>`cita` (alta de cita)

> **Cerrada la inserción directa (`42501`):** usa la RPC `crear_cita` (ver [crear_cita.md](../rpcs/crear_cita.md) y [agenda.md](./agenda.md)).

| Crear                                                               | Regla                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crear_cita`: `agenda.crear` + alcance (`puede_crear_cita_en_area`) | Recepción (TS, Psicología y Jurídico), Jurídico y Psicología (solo su área), Tit y Sub (todas las áreas). TS **no puede crear** (`42501`). Para elegir la persona: `buscar_personas_agenda`. Cambiar estado/reagendar: ver [agenda.md](./agenda.md). |

```ts
const { data, error } = await supabase
  .rpc("crear_cita", {
    p_persona_id: personaId,
    p_area_id: areaId,
    p_programada_en: "2026-12-01T10:00:00-07:00",
    p_recomendada_por: "Trabajo Social",
    p_origen: "regular", // 'umeca' para canalizaciones de UMECA
  })
  .single();
```

- Nace `agendada`.
- Psicología y Jurídico no pueden tener citas de menores de 18 años (RN-01): `23514`.
- Rechaza fecha pasada, expediente archivado o cita duplicada en misma área y hora: `23514`.
- Después invalida `['agenda']` y `['agenda','urgencias']`.

## <a id="derivacion"></a>`derivacion` (canalizaciones)

> **Cerrada la inserción directa (`42501`, migración `33`):** el alta se hace únicamente por [`crear_canalizacion`](../rpcs/crear_canalizacion.md). Los cambios de estado van por [`cambiar_estado_derivacion`](../rpcs/cambiar_estado_derivacion.md) y la lectura por [`get_derivaciones`](../rpcs/get_derivaciones.md) o [`get_historial_canalizaciones`](../rpcs/get_historial_canalizaciones.md).

| Operación        | RPC                                                                   | Regla                                                                                                                                              |
| ---------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alta             | `crear_canalizacion` (`derivacion.gestionar`: Tit, Sub, TS, Psi, Jur) | Valida expediente no archivado, área origen, destino interno vs externo (`otra_institucion`) y mayoría de edad para Psicología/Jurídico (`23514`). |
| Cambio de estado | `cambiar_estado_derivacion`                                           | Transiciones desde `pendiente` / `en_proceso` / `aceptada`.                                                                                        |
| Consulta         | `get_derivaciones`, `get_historial_canalizaciones`                    | Filtrado por área/estado o historial completo de la ficha.                                                                                         |

Nace `pendiente`. Cualquier `insert` o `update` directo sobre `derivacion` devuelve `42501`.
