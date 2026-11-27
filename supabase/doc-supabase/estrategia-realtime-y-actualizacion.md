# Estrategia de Realtime y Actualización de Datos (Implementación Futura)

Guía de arquitectura para mantener los datos actualizados en **`apps/admin`** (web) y **`apps/mobile`** (Android) equilibrando frescura operativa, eficiencia de costos y consumo de recursos en Supabase (conexiones concurrentes, mensajes Realtime, egress y carga en PostgreSQL) y cumplimiento estricto de privacidad (**LGPDPPSO**).

Referencias relacionadas:
- [docs/resiliencia-concurrencia-sesiones.md](../../docs/resiliencia-concurrencia-sesiones.md) (idempotencia, bloqueo optimista, sesiones y caché).
- [supabase/doc-supabase/seguridad-y-privacidad.md](./seguridad-y-privacidad.md) (principios de minimización y confidencialidad).
- [supabase/doc-supabase/buenas-practicas.md](./buenas-practicas.md) (RLS-First y Realtime selectivo).

---

## 1. Principios técnicos obligatorios

1. **Realtime solo opera sobre tablas físicas:** PostgreSQL/Supabase `postgres_changes` no se puede activar sobre vistas (`vista_lista_urgencias`, `vista_informe_*`) ni sobre RPCs.
2. **Prohibido Realtime en datos sensibles (LGPDPPSO):** cada evento de `postgres_changes` evalúa RLS por suscriptor y transmite el payload por WebSocket. **Nunca** se debe publicar en `supabase_realtime` una tabla que contenga CURP, notas clínicas, historial psicológico, agresores o bitácora de auditoría.
3. **Patrón «señal de invalidación» (obligatorio):** cuando una tabla esté en `supabase_realtime`, la suscripción del adaptador **no** inyecta el payload crudo en la UI; únicamente dispara `queryClient.invalidateQueries(...)` para que el RPC o consulta tipada vuelva a traer los datos con las proyecciones y filtros ABAC correctos.
4. **Encapsulamiento hexagonal:** toda suscripción WebSocket vive exclusivamente dentro de un adaptador en `apps/admin/src/infrastructure/supabase/adapters/` (nunca en un componente React), limpia el canal al desmontar (`supabase.removeChannel(channel)`) y re-invalida al reconectar (`status === 'SUBSCRIBED'`).
5. **No disparar bitácora en segundo plano:** las RPC que registran `'ver'` en `bitacora_acceso` (`get_expediente_detalle`, `get_contexto_seguimiento`, `get_cola_alertas`, `get_umeca_citas`) **no** deben usar *polling* agresivo innecesario que infle la auditoría.

---

## 2. Matriz de estrategia por criticidad

### Nivel 1 — Realtime obligatorio (crítico en segundos)

| Tabla | Estado actual | Estrategia recomendada | `queryKey` a invalidar | Fallback / Resiliencia |
|---|---|---|---|---|
| `public.alerta` | **Activo** (`02_atencion.sql`) | Realtime (`INSERT`, `UPDATE`) como señal de invalidación | `['alertas']`, `['dashboard']` | Al reconectar (`SUBSCRIBED`) invalidar `['alertas']`; fallback `refetchInterval: 60_000` si el socket cae; CAS en `tomar_alerta` (`23505`). |

---

### Nivel 2 — Realtime selectivo recomendado (implementación futura)

Son las únicas dos tablas adicionales donde el beneficio operativo multiusuario justifica WebSockets, sin exponer CURP ni narrativas clínicas y respetando RLS por área:

| Tabla | Estado actual | Estrategia recomendada | `queryKey` a invalidar | Justificación operativa |
|---|---|---|---|---|
| `public.cita` | Sin Realtime | **Agregar a `supabase_realtime`** (solo señal) | `['agenda']`, `['urgencias']`, `['dashboard']` | Recepción, Trabajo Social, Psicología y Jurídico operan sobre la misma agenda del día (confirmaciones, cancelaciones, *walk-in*, reagendamientos y paso a `asistio`). |
| `public.derivacion` *(o `canalizacion_evento`)* | Sin Realtime | **Opcional en `supabase_realtime`** (solo señal) | `['derivaciones']`, `['dashboard']` | Permite que Psicología o Jurídico vean de inmediato una nueva canalización enviada por Trabajo Social sin recargar. *(Si se prioriza ahorrar conexiones WebSocket, puede mantenerse en Nivel 3.)* |

---

### Nivel 3 — Sin Realtime: TanStack Query + invalidación por mutación + bloqueo optimista

| Tablas / Vistas / RPCs | `staleTime` sugerido | `refetchOnWindowFocus` | Mecanismo de consistencia | Por qué no Realtime |
|---|---|---|---|---|
| `ficha_registro`, `domicilio`, `atencion`, `orden_proteccion`, `documento` | `30_000` – `60_000` ms | `true` (solo en listados; en detalle con bitácora usar recarga explícita o invalidación tras mutación) | **Bloqueo optimista (`actualizado_en`)** en RPCs (`corregir_seguimiento` → `40001`, `actualizar_domicilio` → `23505`) + invalidación tras mutar | Evita tráfico WebSocket innecesario, protege contra sobrescrituras concurrentes y no infla `bitacora_acceso`. |
| `vista_lista_urgencias` (`get_lista_urgencias`) | `30_000` ms | `true` | Invalidar cuando cambie `cita` (vía Realtime de Nivel 2) o tras `registrar_seguimiento` / `reagendar_cita` | Es una vista; depende directamente de `cita` y `atencion`. |
| `pre_registro` (`get_mi_estado_app`, `verificar_curp`) | `15_000` ms (móvil) / bajo demanda (web) | `true` (móvil al reanudar pantalla) | Invalidación tras `registrar_mi_perfil`, `actualizar_mi_pre_registro`, `enviar_alerta` | Sin necesidad de push en vivo; protege la liga silenciosa por CURP. |
| `actividad_preventiva`, `actividad_empleado` | `120_000` – `300_000` ms | `false` | Invalidación tras `registrar_actividad_preventiva` | Bajo volumen y sin concurrencia crítica. |

---

### Nivel 4 — Nunca Realtime (privacidad LGPDPPSO, auditoría o datos estáticos)

| Recurso | Estrategia recomendada | `staleTime` sugerido | Razón |
|---|---|---|---|
| `persona`, `agresor`, `historial_clinico`, `nota_area`, `estudio_socioeconomico`, `aportante_hogar` | Bajo demanda al abrir expediente/pestaña + bloqueo optimista | `0` – `30_000` ms (sin `refetchInterval`) | Datos personales sensibles (LGPDPPSO). Nunca deben circular por WebSockets ni recargarse en segundo plano. |
| `bitacora_acceso` (`get_bitacora`) | Bajo demanda + botón manual «Actualizar» | `60_000` ms | Alto volumen de inserciones; habilitar Realtime causaría tormentas de eventos por cada lectura o cambio. |
| `vista_informe_mensual`, `vista_informe_anual`, `get_informe`, `get_mapa_calor_asentamiento` | Bajo demanda + botón manual «Actualizar» | `300_000` – `900_000` ms (5–15 min) | Agregaciones costosas que no requieren actualización segundo a segundo. |
| Catálogos `cat_*` y `directorio_institucion` | Caché agresivo (y caché local offline en `apps/mobile`) | `Infinity` (o `3_600_000` ms) | Cambian excepcionalmente. |
| `empleado`, `usuario_externo` | Bajo demanda en administración de cuentas | `300_000` ms | La revocación (`activo = false`) ya es **inmediata en PostgreSQL** porque `auth_rol()`, `es_empleado_activo()` y `es_umeca()` se evalúan en cada petición. |

---

## 3. Plan de implementación futura (cuando se habilite Nivel 2)

### Paso 1 — Nueva migración SQL en `supabase/migrations/`
Cuando el equipo decida activar Realtime para `cita` (y opcionalmente `derivacion`), crear una migración dedicada siguiendo el estándar de `02_atencion.sql`:

```sql
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'cita'
    ) then
      alter publication supabase_realtime add table public.cita;
    end if;

    -- Opcional: habilitar solo si el volumen de conexiones simultáneas lo permite
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'derivacion'
    ) then
      alter publication supabase_realtime add table public.derivacion;
    end if;
  end if;
end
$$;
```

### Paso 2 — Adaptadores en `apps/admin`
1. Exponer un método `subscribe(onChange: () => void): () => void` en el puerto (`CitaRepository`, `DerivacionRepository`) e implementarlo en `SupabaseCitaRepository.ts` / `SupabaseDerivacionRepository.ts`.
2. Aplicar *debounce* de `300–500 ms` antes de llamar a `queryClient.invalidateQueries(...)` para agrupar ráfagas de cambios (por ejemplo, `reagendar_cita` hace `UPDATE` + `INSERT` en la misma transacción).
3. En el callback de estado del canal, si llega `'SUBSCRIBED'` tras reconexión, disparar `onChange()` para recuperar eventos perdidos durante desconexiones de red.
4. Devolver siempre la función de limpieza (`() => { void supabase.removeChannel(channel); }`) y ejecutarla en el `useEffect` del hook de módulo (`features/agenda/api.ts`, `features/canalizaciones/api.ts`).

### Paso 3 — Consideraciones para `apps/mobile` (Android)
- **No abrir WebSockets Realtime en la app móvil** para ahorrar batería, evitar reconexiones en redes inestables y reducir conexiones concurrentes en Supabase.
- Refrescar `get_mi_estado_app()` al entrar a la pantalla principal (`onResume`) y tras `registrar_mi_perfil()` / `enviar_alerta()`.
- Mantener `directorio_institucion` con caché local (Room/DataStore) actualizado bajo demanda con respaldo offline.

### Paso 4 — Verificación (DoD)
- Probar con dos sesiones simultáneas de distinto rol (ej. `recepcion` y `psicologia`) que al confirmar/reagendar una cita en una pestaña, la otra actualiza su agenda en `< 2 s` respetando el filtro de área (Recepción no ve citas de Jurídico).
- Verificar en DevTools → Network (WS) que al salir de la vista de Agenda o Alertas se cierra el canal sin fugas de memoria ni canales duplicados en `React.StrictMode`.
- Confirmar que el payload del WebSocket nunca expone CURP, notas privadas ni historial clínico.
