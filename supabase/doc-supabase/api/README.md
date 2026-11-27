# Referencia de API de Supabase para el front

Esta carpeta documenta **cómo consumir desde el front** (React + TS en `apps/admin`, y la app móvil Kotlin) todo lo que expone la base de datos: RPC, tablas que se usan directo, Storage y Realtime.

- Los contratos técnicos por tarea del Sprint 01 siguen en [`../rpcs/`](../rpcs/README.md). Esta referencia los reúne, los pasa a una sola plantilla y agrega cómo llamarlos, qué devuelven y qué mensaje mostrar en cada error.
- La fuente de verdad sigue siendo la migración. Si algo aquí no coincide con el SQL, gana el SQL y hay que corregir este documento.

---

## 1. Cómo llamar a Supabase desde `apps/admin`

```ts
import { supabase } from '@/infrastructure/supabase/client';
import type { Database } from '@/infrastructure/supabase/database.types';

// Tipos generados de cualquier RPC
type Fn<N extends keyof Database['public']['Functions']> = Database['public']['Functions'][N];
type AgendaArgs = Fn<'get_agenda'>['Args'];
type AgendaRow  = Fn<'get_agenda'>['Returns'][number];

const { data, error } = await supabase.rpc('get_agenda', {
  p_desde: '2026-11-26T00:00:00-07:00',
  p_hasta: '2026-11-27T00:00:00-07:00',
});
if (error) throw traducirErrorRpc(error);   // ver errores.md
```

La llamada vive en el **adaptador** (`infrastructure/supabase/adapters/Supabase<Entidad>Repository.ts`), que mapea `snake_case → camelCase`. El componente nunca llama `supabase` directo: usa el hook de TanStack Query de `features/<modulo>/api.ts` (estándar §4).

### Reglas que aplican a todas las RPC

| Tema | Regla |
|---|---|
| Nombres de parámetros | `snake_case` con prefijo `p_`. Un nombre mal escrito da `PGRST202` (la función "no existe"). |
| Parámetros opcionales | Si no lo mandas, se usa el default de la RPC. Mandar `null` explícito **no siempre** es igual al default (por ejemplo, `p_limite: null` da `23514` en varias RPC). |
| Respuesta `returns table` | `data` siempre es **arreglo**, aunque la RPC devuelva una sola fila. Para una fila usa `.single()` o `data[0]`. |
| Respuesta `jsonb` | `data` es el objeto tal cual (`get_expediente_detalle`). |
| Respuesta `void` | `data` es `null`. Solo revisa `error`. |
| Fechas | Se mandan como string ISO 8601 **con zona horaria** (`toISOString()` sirve). Las respuestas `timestamptz` llegan en UTC; conviértelas a `America/Mazatlan` para mostrarlas. Las `date` llegan como `'YYYY-MM-DD'`. |
| "Hoy" | Las RPC que calculan "hoy" usan `America/Mazatlan`, no la hora del navegador. |
| Enums | Se mandan como string (`'confirmada'`); los arreglos de enum como `string[]` (`['nueva','tomada']`). |
| `smallint` / `integer` | Se mandan como `number`. |
| Seguridad | Todas son `security definer`: la RPC valida el permiso centralizado (`tiene_permiso()` o `es_usuaria_app()`) y repite las reglas ABAC en su `where`. Si el rol no puede, responde `42501`; no devuelve "vacío". |
| Bitácora | Las RPC de lectura sensible registran el `'ver'` solas. No hace falta llamar `registrar_consulta` después de ellas. |
| Tipos | Después de cada migración: `npx supabase gen types typescript --local > apps/admin/src/infrastructure/supabase/database.types.ts`. Si una RPC no aparece en los tipos, falta regenerar. |

---

## 2. Índice por módulo

**Roles:** Tit = `titular`, Sub = `subdireccion`, TS = `trabajo_social`, Psi = `psicologia`, Jur = `juridico`, Rec = `recepcion`, UMECA = `usuario_externo`, App = usuaria de la app móvil.

### Expedientes → [`expedientes.md`](./expedientes.md)

| RPC | Qué hace | Permiso | Roles | Tipo |
|---|---|---|---|---|
| `verificar_curp` | Dice si una CURP ya tiene expediente, persona, pre-registro de la app o es nueva | `expediente.verificar_curp` | Todos los empleados | Lectura + bitácora |
| `buscar_expedientes` | Busca fichas por CURP, folio o nombre (sin acentos) | `expediente.ver` | Tit, Sub, TS, Psi, Jur | Lectura |
| `buscar_pre_registro_por_curp` | Precarga los datos que la usuaria capturó en la app | `expediente.escribir` | Tit, Sub, TS | Lectura |
| `crear_ficha_completa` | Alta atómica de la Ficha Única (persona, ficha, domicilio, estudio) | `expediente.escribir` | Tit, Sub, TS | Escritura |
| `get_expediente_detalle` | Detalle completo de un expediente en un solo `jsonb` | `expediente.ver` | Tit, Sub, TS, Psi, Jur | Lectura + bitácora |
| `archivar_ficha` | Archiva un expediente si no tiene citas futuras ni alertas abiertas | `expediente.escribir` | Tit, Sub, TS | Escritura |
| `get_linea_tiempo` | Línea de tiempo del caso, con detalle solo de lo propio | `expediente.ver` | Tit, Sub, TS, Psi, Jur | Lectura |
| `registrar_consulta` | Deja un `'ver'` en bitácora para lecturas que no pasan por RPC | empleado activo o UMECA | Todos + UMECA | Escritura (bitácora) |

### Atención → [`atencion.md`](./atencion.md)

| RPC | Qué hace | Permiso | Roles | Tipo |
|---|---|---|---|---|
| `get_contexto_seguimiento` | Precarga datos mínimos de la cita del día (sin CURP ni notas ajenas) | `seguimiento.registrar` | TS, Psi, Jur | Lectura + bitácora |
| `registrar_seguimiento` | Hoja de seguimiento: asistencia (cita de hoy), folio único y próxima cita | `seguimiento.registrar` | TS, Psi, Jur | Escritura |
| `corregir_seguimiento` | Corrige un seguimiento (creador mismo día o Dirección) con `p_actualizado_en` | `seguimiento.corregir` | Tit, Sub, TS, Psi, Jur | Escritura |

### Agenda → [`agenda.md`](./agenda.md)

| RPC | Qué hace | Permiso | Roles | Tipo |
|---|---|---|---|---|
| `get_agenda` | Citas de un rango (máx. 31 días) filtradas por rol | empleado activo | Todos los empleados | Lectura |
| `cambiar_estado_cita` | Confirmar, cancelar o marcar inasistencia | empleado activo + área | Todos los empleados | Escritura |
| `reagendar_cita` | Crea la cita nueva y marca la anterior como `reagendada` | empleado activo + área | Todos los empleados | Escritura |
| `get_lista_urgencias` | Prioridad alta sin cita próxima (RF-07) | rol | Tit, Sub, TS, Psi, Rec | Lectura |
| `get_umeca_citas` | Citas de origen UMECA para la dependencia | `es_umeca()` | UMECA | Lectura + bitácora |

### Alertas → [`alertas.md`](./alertas.md)

| RPC | Qué hace | Permiso | Roles | Tipo |
|---|---|---|---|---|
| `get_cola_alertas` | Cola ordenada por prioridad y antigüedad | rol | Tit, Sub, Jur, TS, Psi | Lectura + bitácora |
| `tomar_alerta` | `nueva → tomada` (evita que dos personas tomen la misma) | rol línea 24/7 | Tit, Sub, Jur | Escritura |
| `atender_alerta` | `tomada → atendida` con observaciones | rol línea 24/7 | Tit, Sub, Jur | Escritura |
| Realtime `alerta` | Aviso en vivo de alertas nuevas o cambios | RLS `alerta_select` | Tit, Sub, Jur, TS, Psi, App (las suyas) | Suscripción |

### Derivaciones → [`derivaciones.md`](./derivaciones.md)

| RPC | Qué hace | Permiso | Roles | Tipo |
|---|---|---|---|---|
| `get_derivaciones` | Lista derivaciones por expediente o estado | rol + área | Tit, Sub, TS, Psi, Jur | Lectura |
| `cambiar_estado_derivacion` | Transiciones `pendiente → en_proceso → concluida`, o `cancelada` | rol + área | Tit, Sub, TS, Psi, Jur | Escritura |

### Actividades preventivas → [`actividades.md`](./actividades.md)

| RPC | Qué hace | Permiso | Roles | Tipo |
|---|---|---|---|---|
| `registrar_actividad_preventiva` | Alta de actividad con participantes | `actividad.registrar` | Tit, Sub, TS, Psi, Jur | Escritura |
| `get_actividades_preventivas` | Lista de actividades con participantes | `actividad.ver` | Todos los empleados | Lectura |

### Informes y auditoría → [`informes.md`](./informes.md)

| RPC | Qué hace | Permiso | Roles | Tipo |
|---|---|---|---|---|
| `get_informe` | Informe mensual o anual por área y tipo de atención | `informe.ver` | Tit, Sub, TS, Psi, Jur | Lectura |
| `get_bitacora` | Consulta de la bitácora de accesos | `bitacora.ver` | Tit, Sub | Lectura |
| `get_mapa_calor_asentamiento` | Conteos por colonia con umbral de privacidad | `expediente.ver` | Tit, Sub, TS, Psi, Jur | Lectura |

### App móvil → [`app-movil.md`](./app-movil.md)

| RPC / tabla | Qué hace | Permiso | Roles | Tipo |
|---|---|---|---|---|
| `registrar_mi_perfil` | Registra el perfil de la usuaria con aviso de privacidad obligatorio | `es_usuaria_app()` | App | Escritura |
| `get_mi_estado_app` | Consulta si tiene perfil, si puede enviar alertas y conteo de última hora | `es_usuaria_app()` | App | Lectura |
| `get_mi_pre_registro` | Lee su pre-registro sin `persona_id` ni `estado` | `auth.uid()` | App | Lectura |
| `actualizar_mi_pre_registro` | Edita nombre, apellidos o celular | `auth.uid()` | App | Escritura |
| `enviar_alerta` | Botón de alerta desde la app (límite de 3 por hora) | `es_usuaria_app()` | App | Escritura |
| `desactivar_mi_cuenta` | Desactiva perfil y bloquea la cuenta para impedir alertas | `es_usuaria_app()` | App | Escritura |

### Fuera de RPC

- [`storage.md`](./storage.md): bucket privado `documentos` (subir, URL firmada, limpiar huérfanos).
- [`tablas-directas.md`](./tablas-directas.md): catálogos y tablas que el front usa con `.from()` (citas nuevas, historial clínico, notas, órdenes, agresores, derivaciones, documentos) y qué rol puede hacer qué.
- [`errores.md`](./errores.md): códigos de error, qué significan y qué mensaje mostrar.

---

## 3. Matriz rápida rol × RPC

✅ puede · ⚠️ puede con filtro (por área o por dueño) · — rechazado con `42501`

| RPC | Tit/Sub | TS | Psi | Jur | Rec | UMECA | App |
|---|---|---|---|---|---|---|---|
| `verificar_curp` | ✅ | ✅ | ✅ (sin pre-registro) | ✅ (sin pre-registro) | ⚠️ salida reducida | — | — |
| `buscar_expedientes` | ✅ | ✅ | ✅ | ✅ | — | — | — |
| `buscar_pre_registro_por_curp` | ✅ | ✅ | — | — | — | — | — |
| `crear_ficha_completa` | ✅ | ✅ | — | — | — | — | — |
| `get_expediente_detalle` | ✅ | ⚠️ citas TS+Psi | ⚠️ citas de su área | ⚠️ citas de su área | — | — | — |
| `archivar_ficha` | ✅ | ✅ | — | — | — | — | — |
| `get_linea_tiempo` | ✅ | ⚠️ detalle solo propio | ⚠️ | ⚠️ | — | — | — |
| `registrar_consulta` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `registrar_seguimiento` | — | ⚠️ su área | ⚠️ su área | ⚠️ su área | — | — | — |
| `get_agenda` | ✅ | ⚠️ TS+Psi | ⚠️ su área | ⚠️ su área | ⚠️ TS+Psi | — | — |
| `cambiar_estado_cita` / `reagendar_cita` | ✅ | ⚠️ su área | ⚠️ su área | ⚠️ su área | ⚠️ TS+Psi | — | — |
| `get_lista_urgencias` | ✅ | ✅ | ✅ | — | ✅ | — | — |
| `get_umeca_citas` | — | — | — | — | — | ✅ | — |
| `get_cola_alertas` | ✅ | ✅ (solo ver) | ✅ (solo ver) | ✅ | — | — | — |
| `tomar_alerta` / `atender_alerta` | ✅ | — | — | ✅ | — | — | — |
| `get_derivaciones` / `cambiar_estado_derivacion` | ✅ | ✅ | ⚠️ origen o destino su área | ⚠️ | — | — | — |
| `registrar_actividad_preventiva` | ✅ | ✅ | ✅ | ✅ | — | — | — |
| `get_actividades_preventivas` | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| `get_informe` | ✅ | ⚠️ su área | ⚠️ su área | ⚠️ su área | — | — | — |
| `get_bitacora` | ✅ | — | — | — | — | — | — |
| `get_mapa_calor_asentamiento` | ✅ | ✅ | ✅ | ✅ | — | — | — |
| `get_mi_pre_registro` / `actualizar_mi_pre_registro` | — | — | — | — | — | — | ✅ |

---

## 4. Plantilla de cada RPC en esta carpeta

Cada RPC de los archivos por módulo trae siempre las mismas secciones:

1. **Ficha:** permiso, roles, tipo de operación, si escribe en bitácora y migración.
2. **Llamada:** ejemplo con `supabase.rpc(...)`.
3. **Parámetros:** nombre, tipo TS, si es obligatorio y regla.
4. **Respuesta:** tipo TS de la fila u objeto, y ejemplo cuando ayuda.
5. **Comportamiento:** qué ve o hace cada rol, efectos (triggers, cambios de estado, bitácora).
6. **Errores:** código, cuándo pasa y mensaje sugerido para la UI.
7. **En el front:** adaptador y hook que la consumen o deberían consumirla.

---

## 5. Notas conocidas (26-nov-2026)

- `database.types.ts` no incluye todavía `registrar_seguimiento`. Hay que regenerarlo antes de usar esa RPC con tipos.
- `get_agenda`, `cambiar_estado_cita`, `reagendar_cita`, `get_lista_urgencias`, `get_cola_alertas`, `tomar_alerta`, `atender_alerta`, `get_derivaciones` y `cambiar_estado_derivacion` validan con `e.rol in (...)` en lugar de `tiene_permiso('<clave>')`. El resultado por rol es el mismo que dice este documento, pero no siguen el estándar §3.2. Si se cambia un permiso en `tiene_permiso()`, estas RPC no se enteran.
- La mayoría de estas RPC todavía no tienen adaptador en el front. La columna "En el front" dice cuál toca según el anexo del sprint (§8.3).
