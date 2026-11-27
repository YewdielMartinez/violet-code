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

| Tabla | Para qué | Leer | Escribir |
|---|---|---|---|
| `cat_area` | Áreas (TS, Psicología, Jurídico, ...) | Cualquier sesión | `catalogos.gestionar` (Tit, Sub) |
| `cat_asentamiento` | Colonias SEPOMEX con CP y coordenadas | Cualquier sesión | Tit, Sub |
| `cat_ocupacion` | Ocupaciones | Cualquier sesión | Tit, Sub |
| `cat_parentesco` | Parentescos (agresor, aportantes) | Cualquier sesión | Tit, Sub |
| `cat_tipo_atencion` | Tipos de atención por área (para `registrar_seguimiento`) | Cualquier sesión | Tit, Sub |
| `cat_tipo_actividad` | Tipos de actividad preventiva | Cualquier sesión | Tit, Sub |
| `cat_tipo_documento` | Tipos de documento | Cualquier sesión | Tit, Sub |

```ts
const { data } = await supabase
  .from('cat_tipo_atencion')
  .select('id, clave, nombre, area_id')
  .eq('area_id', miAreaId)
  .order('nombre')
  .limit(100);
```

Los catálogos cambian poco: en TanStack Query usa `staleTime: Infinity` o de varias horas.

Las listas cerradas (estado civil, escolaridad, tipo de vivienda, estados de cita, etc.) **no** son tablas: son `enum` de Postgres. Sus valores salen de `Database['public']['Enums']` en los tipos generados.

## `directorio_institucion`

| Leer | Escribir |
|---|---|
| Empleados: todas (incluidas inactivas). UMECA y app: solo activas. | `directorio.gestionar` (Tit, Sub) |

Se usa para derivaciones externas (`institucion_id`) y en la app (directorio de apoyo).

---

## Tablas del expediente

| Tabla | Leer | Crear / editar | Nota |
|---|---|---|---|
| `persona` | `expediente.ver` (Tit, Sub, TS, Psi, Jur) | `expediente.escribir` (Tit, Sub, TS) | Recepción ya no la lee (B-08); para buscar usa `verificar_curp`. |
| `ficha_registro` | `expediente.ver` | `expediente.escribir` | El alta va por `crear_ficha_completa`; archivar, por `archivar_ficha`. |
| `ficha_servicio_solicitado`, `estudio_socioeconomico`, `aportante_hogar` | `expediente.ver` | `expediente.escribir` | Alta en `crear_ficha_completa`; edición por `actualizar_ficha` y `registrar_estudio_socioeconomico` ([expedientes.md](./expedientes.md)). |
| `domicilio` | `expediente.ver` | `expediente.ver` | |
| `agresor` | `agresor.acceder` (Tit, Sub, TS, Psi, Jur) | `agresor.acceder` | Al abrirlo, llama `registrar_consulta('agresor', id)`. Edición con bloqueo optimista por `actualizado_en`. |
| `documento` | `expediente.ver` | `expediente.ver` | Ver [storage.md](./storage.md). |

### `orden_proteccion`

| Leer | Crear / editar |
|---|---|
| `expediente.ver` | `orden_proteccion.escribir` (Tit, Sub, TS, Jur) |

```ts
await supabase.from('orden_proteccion').insert({
  ficha_id, agresor_id,            // agresor_id debe ser de la misma ficha
  numero_oficio, autoridad_emisora,
  fecha_emision: '2026-11-20',     // date
  fecha_vigencia: '2027-02-20',    // >= fecha_emision o null
  estado: 'vigente',               // 'vigente' | 'vencida' | 'cancelada' | 'en_tramite'
});
```

Al crear o cambiar una orden vigente, un trigger sube a `alta` las alertas `nueva` de esa persona.

### `historial_clinico`

| Leer | Crear / editar |
|---|---|
| `historial_clinico.acceder` (Tit, Sub, Psi) | Igual |

Una sola fila por ficha (`ficha_id` único). Para leer y guardar usa las RPC [`get_historial_clinico` y `guardar_historial_clinico`](./expedientes.md#guardar_historial_clinico-y-get_historial_clinico) (registran `'ver'` en bitácora, validan RN-01 y aplican bloqueo optimista).

### `nota_area`

| Leer | Crear / editar |
|---|---|
| `seguimiento.registrar` y **solo su área** (TS, Psi, Jur) | Igual |

Notas privadas de cada área. Dirección **no** las ve. `area_id` debe ser el del actor; si mandas otro, `42501`.

```ts
await supabase.from('nota_area').insert({ ficha_id, area_id: miAreaId, contenido });
```

### `atencion`

| Leer | Crear / editar |
|---|---|
| `expediente.ver`: Dirección todas; áreas solo la suya | Igual |

Para registrar una atención usa `registrar_seguimiento`, que además marca la cita y el estado de la ficha. El `insert` directo solo para correcciones.

---

## <a id="cita"></a>`cita` (alta de cita)

No hay RPC para crear una cita: es un `insert` directo. Leer, cambiar estado y reagendar sí van por RPC (ver [agenda.md](./agenda.md)).

| Crear | Regla |
|---|---|
| `agenda.gestionar` + alcance | Tit, Sub: cualquier área. Recepción: TS y Psicología. TS, Psi, Jur: solo su área. |

```ts
const { data, error } = await supabase
  .from('cita')
  .insert({
    persona_id,
    area_id,
    programada_en: '2026-12-01T10:00:00-07:00',
    prioridad: 'media',            // opcional
    recomendada_por: 'Trabajo Social',
    origen: 'regular',             // 'umeca' para canalizaciones de UMECA
  })
  .select('id, programada_en, estado')
  .single();
```

- Nace `agendada`. No mandes `estado`, `confirmada_en` ni `reagendada_de`.
- Psicología y Jurídico no pueden tener citas de menores de 18 años (RN-01): `23514`.
- Recepción ya no lee `persona`: obtiene `persona_id` de `verificar_curp`.
- Después invalida `['agenda']` y `['agenda','urgencias']`.

## <a id="derivacion"></a>`derivacion` (alta)

| Crear | Regla |
|---|---|
| `derivacion.gestionar` (Tit, Sub, TS, Psi, Jur) | Un trigger valida destino y mayoría de edad. |

```ts
// Interna
await supabase.from('derivacion').insert({
  ficha_id, area_origen_id: miAreaId,
  destino: 'psicologia', area_destino_id: idAreaPsicologia,
  motivo: 'Requiere contención emocional',
});

// Externa
await supabase.from('derivacion').insert({
  ficha_id, area_origen_id: miAreaId,
  destino: 'otra_institucion', institucion_id: idDelDirectorio,   // o institucion_otra: 'Nombre'
  motivo: 'Asesoría laboral',
});
```

| Regla (CHECK o trigger) | Error |
|---|---|
| Destino interno (`trabajo_social`, `psicologia`, `juridico`) ⇔ lleva `area_destino_id` | `23514` |
| Interno no lleva `institucion_id` ni `institucion_otra` | `23514` |
| `otra_institucion` necesita `institucion_id` o `institucion_otra` | `23514` |
| `area_destino_id` debe corresponder al `destino` | `23514` |
| Psi/Jur solo para mayores de 18 | `23514` |

Nace `pendiente`. Los cambios de estado van por `cambiar_estado_derivacion`.
