# Alertas (línea 24/7)

[← Índice](./README.md) · Errores: [errores.md](./errores.md)

Estados: `nueva → tomada → atendida`. Orígenes: `app_movil`, `telefono`, `presencial`.

| Paso | Cómo | Quién |
|---|---|---|
| Alta desde la app | `POST /rest/v1/rpc/enviar_alerta` (ver [app-movil.md](./app-movil.md#enviar_alerta)) | Usuaria de la app (`es_usuaria_app()`) |
| Alta por teléfono o presencial | `.from('alerta').insert` con `origen: 'telefono' \| 'presencial'` | Tit, Sub, Jur (`alerta.atender`) |
| Ver la cola | `get_cola_alertas` | Tit, Sub, Jur, TS, Psi |
| Tomar | `tomar_alerta` | Tit, Sub, Jur |
| Concluir | `atender_alerta` | Tit, Sub, Jur |
| Aviso en vivo | Realtime sobre `alerta` | Quien puede ver la cola |

**Prioridad:** la ajusta un trigger al insertar. Las de la app entran siempre como `media`; las de teléfono o presencial usan la que mande el personal (default `media`). En ambos casos, si la persona tiene orden de protección vigente, sube a `alta`. Si después entra o cambia una orden vigente, otro trigger sube a `alta` sus alertas que sigan `nueva`.

---

## `get_cola_alertas`

> La cola de la línea 24/7, ordenada por prioridad (alta → baja) y, dentro de cada prioridad, la más antigua primero.

| Permiso | Roles | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| `tiene_permiso('alerta.ver_cola')` | Tit, Sub, Jur, TS, Psi | Lectura | Sí: un `'ver'` sobre `alerta` (registro `'cola'`) en **cada** llamada | `_47_tiene_permiso_agenda_alertas` *(actualiza `_24_rpc_cola_alertas`)* |

**Llamada**

```ts
const { data, error } = await supabase.rpc('get_cola_alertas', {
  p_estados: ['nueva', 'tomada'],
  p_limite: 50,
});
```

**Parámetros**

| Parámetro | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `p_estados` | `EstadoAlerta[]` | No | Default `['nueva','tomada']`. |
| `p_limite` | `number` | No | `1..200`, default 50. |

**Respuesta** (arreglo)

```ts
interface ColaAlertaRow {
  alerta_id: string;
  origen: 'app_movil' | 'telefono' | 'presencial';
  prioridad: 'alta' | 'media' | 'baja';
  estado: 'nueva' | 'tomada' | 'atendida';
  creado_en: string;
  tomada_en: string | null;
  atendida_por_nombre: string | null;  // quién la tomó
  persona_id: string | null;           // null si la usuaria solo existe en la app
  ficha_id: string | null;
  folio: string | null;
  nombre_completo: string | null;
  celular: string | null;
  tiene_orden_vigente: boolean;
  asentamiento_nombre: string | null;
}
```

**Comportamiento**

- TS y Psicología pueden **ver** la cola, pero no tomar ni atender. En la UI oculta esos botones para ellos.
- Como cada llamada escribe en bitácora, no uses `refetchInterval` corto. Refresca con Realtime (abajo) o al volver a la pestaña.

**Errores**

| Código | Cuándo | Mensaje UI |
|---|---|---|
| `42501` | Recepción, UMECA, app, inactivo | Vista de "sin acceso" |
| `23514` | `p_limite` fuera de `1..200` | `error.message` |

**En el front:** `SupabaseAlertaRepository.listarCola` · `solicitudes/useColaAlertas` · `queryKey ['alertas','cola',estados]`.

---

## `tomar_alerta`

> Asigna la alerta a quien la toma. Bloquea la fila, así que si dos personas pulsan "Tomar" al mismo tiempo, solo una gana.

| Permiso | Roles | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| Rol línea 24/7 | Tit, Sub, Jur | Escritura | Sí, por trigger | `_24_rpc_cola_alertas` |

**Llamada**

```ts
const { data, error } = await supabase.rpc('tomar_alerta', { p_alerta_id: alertaId }).single();
```

**Respuesta**

```ts
interface AlertaEstadoRow {
  alerta_id: string;
  estado: 'tomada';
  tomada_en: string;
  atendida_en: null;
  atendida_por: string;  // id del empleado que la tomó
}
```

**Errores**

| Código | Cuándo | Mensaje UI |
|---|---|---|
| `42501` | TS, Psi, Rec u otro sin línea 24/7 | Fijo de permiso |
| `23505` | Ya está `tomada` (por otra persona, o por ti en otra pestaña) | `error.message` y refrescar la cola |
| `23514` | Alerta inexistente o ya `atendida` | `error.message` |

**En el front:** `SupabaseAlertaRepository.tomar` · `solicitudes/useTomarAlerta` (invalida solo `['alertas','cola']`).

---

## `atender_alerta`

> Concluye la atención de una alerta tomada.

| Permiso | Roles | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| Rol línea 24/7 | Tit, Sub, Jur | Escritura | Sí, por trigger | `_24_rpc_cola_alertas` |

**Llamada**

```ts
const { data, error } = await supabase
  .rpc('atender_alerta', { p_alerta_id: alertaId, p_observaciones: 'Se contactó a la usuaria y se canalizó a Jurídico' })
  .single();
```

**Respuesta:** igual que `tomar_alerta`, con `estado: 'atendida'` y `atendida_en` con fecha.

**Comportamiento:** solo desde `tomada`. Cualquier persona de la línea 24/7 puede concluirla, no solo quien la tomó.

**Errores**

| Código | Cuándo | Mensaje UI |
|---|---|---|
| `42501` | Sin línea 24/7 | Fijo de permiso |
| `23514` | Inexistente, observaciones de más de 2000 caracteres, o no está `tomada` | `error.message` |

**En el front:** `SupabaseAlertaRepository.atender` · `solicitudes/useAtenderAlerta` (invalida `['alertas','cola']`).

---

## Realtime sobre `alerta`

La tabla `alerta` está en la publicación `supabase_realtime`. Realtime respeta la RLS `alerta_select`:

- Personal con `alerta.ver_cola` (Tit, Sub, Jur, TS, Psi) recibe cambios de todas las alertas.
- La usuaria de la app solo recibe las de su propio pre-registro.
- Recepción y UMECA no reciben nada.

El evento trae la fila cruda de `alerta` (sin nombre, folio ni colonia). Úsalo como **aviso** y vuelve a pedir la cola:

```ts
useEffect(() => {
  const canal = supabase
    .channel('alertas-cola')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'alerta' },
      (payload) => {
        if (payload.eventType === 'INSERT' && payload.new.prioridad === 'alta') {
          avisarAlertaAlta();   // sonido o toast
        }
        queryClient.invalidateQueries({ queryKey: ['alertas', 'cola'] });
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(canal);
  };
}, [queryClient]);
```

- Monta la suscripción una sola vez (por ejemplo, en el layout de la línea 24/7), no en cada tarjeta.
- Si la sesión cambia de usuaria, quita el canal y créalo de nuevo para que tome el nuevo JWT.
- Para no llenar la bitácora, agrupa: si llegan varios eventos seguidos, invalida una vez con *debounce* de 1 o 2 segundos.

**En el front:** todavía no hay suscripción. Sugerido: hook `solicitudes/useAlertasRealtime`.
