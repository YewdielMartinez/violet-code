# Estándar de Resiliencia, Idempotencia, Concurrencia y Sesiones

Reglas técnicas obligatorias para **`apps/admin`**, **`apps/mobile`** y **`supabase/`** destinadas a evitar duplicados, condiciones de carrera, pérdida de datos y accesos indebidos en equipos compartidos o bajo red inestable.

---

## 1. Idempotencia (doble clic, reintentos y botón de ayuda)

### Protecciones activas en PostgreSQL (`UNIQUE`)
La base de datos ya impide duplicados críticos mediante restricciones únicas:
- `persona.curp` — una sola persona por CURP.
- `ficha_registro.persona_id` y `ficha_registro.folio` — una sola Ficha Única y un folio único por persona.
- `domicilio_persona_actual_uidx` (`where activo and es_actual`) y `estudio_socioeconomico_ficha_actual_uidx` (`where activo and es_actual`) — solo un registro vigente a la vez.
- `cita.reagendada_de` — una cita cancelada solo puede originar una cita reagendada.
- `atencion.cita_id` — máximo una Hoja de Seguimiento por cita.
- `historial_clinico.ficha_id` — un único Historial Clínico por expediente.
- `pre_registro_curp_activo_uidx` (`where activo`) — un único pre-registro móvil activo por CURP.

### Reglas en Frontend y Móvil
1. **Nunca reintentar mutaciones automáticamente:** en TanStack Query toda `useMutation` debe operar con `retry: false` (los reintentos automáticos quedan reservados solo para queries de lectura).
2. **Bloqueo visual de envíos en curso:** usar `LoadingButton` (o estado `isPending` deshabilitando el botón `submit`) para evitar doble envío por clic repetido.
3. **Manejo idempotente de duplicados (`23505`):**
   - Si Trabajo Social intenta dar de alta una CURP que otro usuario acaba de registrar (`23505`), el adaptador no falla de forma opaca: notifica *"Esta persona ya está registrada"* y permite abrir el expediente existente.
   - En `historial_clinico`, al existir relación `1:1` por `ficha_id`, usar `upsert` (o consultar primero y decidir `insert` vs. `update` por primera sesión / subsecuente).
   - En `cita` y `atencion`, capturar `23505` sobre `reagendada_de` / `cita_id` e invalidar la agenda para mostrar el registro ya creado.
4. **Botón de ayuda en `apps/mobile`:** tras emitir una alerta real, aplicar una ventana de enfriamiento (*cooldown* visual y lógico, p. ej. 30–60 s) para evitar múltiples alertas por pulsaciones repetidas bajo estrés o mala señal.

---

## 2. Concurrencia y condiciones de carrera

### A. Toma de alertas 24/7 (`Compare-And-Swap`)
Dos personas de Dirección o Jurídico pueden intentar tomar la misma alerta simultáneamente. El adaptador **nunca** debe hacer un `UPDATE` ciego solo por `id`:

```ts
// Solo toma la alerta si sigue en estado 'nueva'
const { data, error } = await supabase
  .from('alerta')
  .update({ estado: 'tomada', tomada_en: new Date().toISOString(), atendida_por: empleadoId })
  .eq('id', alertaId)
  .eq('estado', 'nueva')
  .select('id')
  .maybeSingle();

if (!data && !error) {
  throw new ConcurrencyError('Esta alerta ya fue tomada por otra compañera.');
}
```

Al recibir `ConcurrencyError`, la UI muestra un `toast` informativo e invalida la bandeja de alertas para reflejar a quién quedó asignada.

### B. Edición concurrente en expedientes e historial (`Bloqueo Optimista`)
Todas las tablas operativas cuentan con `actualizado_en` mantenido automáticamente por el trigger `set_actualizado_en()`. En formularios de edición crítica (`ficha_registro`, `agresor`, `historial_clinico`, `orden_proteccion`):
- Conservar el `actualizadoEn` leído al abrir el registro.
- Enviar `.eq('actualizado_en', esperado)` en el `.update(...)` acompañado de `.select('id').maybeSingle()`.
- Si devuelve `null` sin error SQL, significa que otro usuario modificó el registro mientras estaba abierto: informar conflicto al usuario y ofrecer recargar los datos recientes antes de sobrescribir.

### C. Sincronización entre pestañas del mismo navegador
`apps/admin` mantiene la suscripción global `onAuthStateChange` en `shared/auth/session.ts` y `staleTime` en TanStack Query: si una pestaña cierra sesión, todas las pestañas abiertas cierran sesión de inmediato.

---

## 3. Sesiones simultáneas y equipos compartidos

1. **Cuentas nominales estrictamente individuales:** está prohibido compartir correo/contraseña entre compañeras (rompe la trazabilidad legal de `bitacora_acceso`, `creado_por` y `atendida_por`).
2. **Equipos compartidos (Recepción / áreas comunes):**
   - `apps/admin/src/shared/auth/session.ts` aplica cierre automático por inactividad (`30 min`) ante ausencia de interacción.
   - Al terminar turno en PC compartida, usar siempre **Cerrar sesión** desde el menú de opciones.
   - Soportar cierre global (`supabase.auth.signOut({ scope: 'global' })`) cuando alguien necesite invalidar sesiones abiertas en otros navegadores o dispositivos.
3. **Política de múltiples pestañas vs. sesiones simultáneas entre dispositivos:**
   - En un mismo navegador se permiten múltiples pestañas usando la misma sesión sincronizada.
   - Para impedir sesiones simultáneas de la misma cuenta en distintas computadoras en producción, habilitar *Single Session per User* en Supabase Auth (si el plan activo lo soporta) o invalidar sesiones previas mediante `signInWithPassword` + cierre global según política operativa de SEMUJERES.
4. **Revocación inmediata (`activo = false`):**
   - Al desactivar un empleado (`empleado.activo = false`) o usuario externo (`usuario_externo.activo = false`), las funciones RLS (`auth_rol()`, `es_empleado_activo()`, `es_umeca()`) deniegan **al instante** cualquier consulta o escritura en PostgreSQL aunque el JWT en memoria siga vigente.
   - En `apps/admin`, `SupabaseAuthRepository` también bloquea el inicio o reanudación de sesión cuando `activo === false`.

---

## 4. Atomicidad multi-tabla (transacciones)

Las operaciones que involucran múltiples tablas dependientes **no deben ejecutarse como una cascada de inserts sueltos desde el navegador** cuando un fallo intermedio dejaría datos huérfanos o inconsistentes:
- Ejemplo principal: alta inicial de **Ficha Única** (`persona` + `domicilio` + `ficha_registro` + `ficha_servicio_solicitado` + `estudio_socioeconomico` + `aportante_hogar`).
- Regla: encapsular las altas compuestas críticas en una **función RPC transaccional en PostgreSQL** (toda la función corre en una sola transacción `BEGIN ... COMMIT` / rollback automático ante cualquier error) con `set search_path = public` y validación explícita de permisos RLS/rol dentro del RPC.

---

## 5. Catálogo estándar de errores PostgreSQL / PostgREST

Todo adaptador de `infrastructure/supabase/adapters/` debe traducir códigos técnicos de PostgreSQL / PostgREST a errores de dominio con mensajes claros en español, **sin exponer nombres internos de constraints, SQL ni PII**:

| Código | Causa real | Traducción estándar en adaptador / UI |
|---|---|---|
| `23505` | Violación de restricción `UNIQUE` (CURP duplicada, cita ya reagendada, seguimiento ya creado) | *"Este registro ya existe."* + abrir o refrescar el registro existente |
| `23503` | Llave foránea inválida o catálogo inexistente | *"Referencia inválida o catálogo no disponible. Recarga e intenta de nuevo."* |
| `42501` | Sin privilegios o denegado por política RLS / usuario inactivo | *"No tienes permisos para realizar esta acción."* |
| `P0001` | Regla de negocio lanzada por trigger/función (ej. `RN-01`: menor de 18 años en cita de Psicología o Jurídico) | Mostrar el mensaje controlado de la regla de negocio al usuario |
| `PGRST116` | Registro no encontrado en `.single()` (o conflicto de bloqueo optimista / CAS en `.update()`) | Tratar como no encontrado o conflicto de concurrencia según el caso |

---

## 6. Zonas horarias y fechas (`America/Mazatlan` / UTC)

- Todas las columnas `timestamptz` en PostgreSQL se almacenan en **UTC**.
- Las ventanas de consulta por *"día actual"*, *"citas de mañana pendientes de confirmar"*, calendario de agenda e informes deben calcularse usando la hora local operativa de **Ahome, Sinaloa (`America/Mazatlan`)** (o el inicio/fin del día en zona local convertido correctamente a ISO con offset), evitando que después de las 17:00 h (00:00 UTC) las consultas salten al día siguiente.
- Las fechas puras (`date`, como `fecha_nacimiento`, `fecha_emision`, `fecha_vigencia`, `fecha_estudio`) deben manipularse como cadenas `YYYY-MM-DD` sin pasarlas por `new Date('YYYY-MM-DD')` en UTC para evitar desfases de un día.

---

## 7. Caché de TanStack Query, invalidación y Realtime

1. **Invalidación por dominio tras cada mutación:** toda mutación exitosa debe invalidar sus `queryKey` relacionadas (`expedientes`, `agenda`, `alertas`, `dashboard`) para no mostrar datos obsoletos.
2. **Realtime en Alertas (`supabase_realtime`):**
   - Toda suscripción WebSocket vive encapsulada dentro del adaptador correspondiente (`SupabaseAlertaRepository.ts`), nunca directo en un componente React.
   - Limpiar siempre el canal al desmontar (`supabase.removeChannel(channel)`).
   - Al recibir evento `SUBSCRIBED` tras una caída/reconexión de red, disparar `invalidateQueries(['alerts'])` para recuperar alertas emitidas durante la desconexión.

---

## 8. Formularios largos, red inestable y privacidad en navegador

- **Protección contra pérdida accidental:** en formularios extensos (`Ficha Única`, `Estudio Socioeconómico`, `Historial Clínico`), activar aviso de salida (`beforeunload` / confirmación) mientras existan cambios sin guardar (`isDirty`).
- **Prohibido guardar PII en almacenamiento del navegador:** **nunca** persistir borradores con CURP, nombres, teléfonos, domicilios ni notas clínicas en `localStorage`, `sessionStorage` o IndexedDB sin cifrado, ya que en equipos compartidos quedarían expuestos al siguiente usuario que abra el navegador. *(En `apps/mobile`, tampoco guardar datos sensibles de la usuaria en Room sin cifrado).*
