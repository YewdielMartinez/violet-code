# Reglas de trabajo en `supabase/`

Guía operativa obligatoria para cualquier persona o agente que modifique esquema, migraciones, políticas RLS, funciones RPC, seeds, pruebas `pgTAP` o documentación dentro de `supabase/` en **Violet Code** (complementa a [../AGENT.md](../AGENT.md)).

---

## 1. Reglas no negociables

- **Solo entorno local (Docker):** trabajar siempre sobre la pila local (`127.0.0.1:54322`). **Nunca** usar `--remote` ni apuntar comandos de migración/reset contra el proyecto remoto.
- **Migraciones inmutables:** **nunca** editar migraciones ya aplicadas o integradas en `develop`. Todo cambio de esquema, RLS o RPC va en una **migración nueva**.
- **Sin datos reales ni credenciales ad-hoc:** prohibido versionar PII real, archivos `.env*`, dumps, `supabase/snippets/` o usuarios de prueba fuera de los actores deterministas de `seed.sql`.
- **Control de cambios y Notion:** no ejecutar comandos `git` de escritura (`add`, `commit`, `push`, `checkout`, `restore`) ni crear o modificar registros en Notion sin instrucción explícita del usuario.

---

## 2. Migraciones, RPCs y RLS

### Nomenclatura y secuencia
- Nombrar cada archivo como `supabase/migrations/<YYYYMMDDHHMMSS>_<NN>_<descripcion_snake_case>.sql` siguiendo el consecutivo actual (por ejemplo, `20261128002100_62_detalle_actualizado_en.sql`).
- Antes de escribir un `create or replace function` o redefinir una política RLS, **leer la última migración que tocó ese objeto** (buscar en `supabase/migrations/`) para no sobrescribir ajustes recientes ni reintroducir bugs corregidos.

### Funciones RPC
- Usar `language plpgsql`, `security definer`, `set search_path = public`.
- Cerrar privilegios al final de la definición:
  ```sql
  revoke execute on function public.<nombre>(...) from public, anon;
  grant  execute on function public.<nombre>(...) to authenticated;
  ```
- Validar permisos al inicio con `public.tiene_permiso('<clave>')` (no con listas de roles escritas a mano), salvo casos específicos documentados (`es_umeca()`, usuaria app móvil con `auth.uid()`).
- Si cambia la lista o tipos de parámetros de una función existente, hacer `drop function if exists public.<nombre>(<firma_anterior>);` en la nueva migración antes de crear la nueva firma.
- Respetar las reglas transversales del sistema:
  - **Sin borrado físico (`RN-15.1`):** usar baja lógica (`activo = false`) o cambio de `estado`.
  - **Bloqueo optimista:** cuando una RPC edite registros existentes, exigir `p_actualizado_en` y lanzar `23505` si cambió respecto al valor en BD.
  - **Bitácora (`RF-22`):** registrar consultas/cambios en `public.bitacora_acceso` según corresponda al contrato.
- Usar códigos `SQLSTATE` estándar esperados por el frontend ([doc-supabase/api/errores.md](./doc-supabase/api/errores.md)):
  - `42501`: sin permiso RBAC/ABAC o sesión inválida.
  - `23514`: validación de negocio (expediente archivado, campo obligatorio, rango inválido, registro inexistente/inactivo).
  - `23505`: duplicado (p. ej. CURP existente) o conflicto de concurrencia optimista (`actualizado_en`).
  - `40001` / `P0001`: serialización o regla explícita de aplicación.

### Políticas RLS
- Todo helper en `using` / `with check` (`tiene_permiso`, `auth_rol`, `auth_area_id`, `es_direccion`, `es_area_atencion`, `area_id_por_clave`) debe ir envuelto en `(select ...)` para aprovechar `InitPlan` y cumplir con `supabase/tests/21_rls.test.sql`.
- Al modificar una política existente en una migración nueva, usar `drop policy if exists <nombre> on public.<tabla>;` seguido de `create policy ...` conservando el uso de `tiene_permiso(...)` cuando aplique.
- No reabrir tablas cerradas por RPC (como `agresor`, `atencion`, `derivacion`, `historial_clinico`, `cita_insert`, `domicilio`, etc.).

---

## 3. Pruebas `pgTAP` (`supabase/tests/`)

- Todo archivo de prueba debe:
  1. Iniciar con `create extension if not exists pgtap with schema extensions;`.
  2. Envolverse en `begin; ... select * from finish(); rollback;`.
  3. Declarar el número exacto de aserciones en `select plan(N);`.
  4. Usar `grant execute on function pg_temp.set_actor(uuid) to public;` si define `pg_temp.set_actor` (por la migración 31, las funciones nuevas no otorgan `EXECUTE` a `PUBLIC` por defecto).
- Probar tanto el camino feliz (roles autorizados y persistencia esperada) como los rechazos esperados (`42501` por rol sin permiso, `23514` por regla de negocio o expediente archivado, `23505` por conflicto optimista si aplica).
- Si se modifica una política RLS existente de las tablas auditadas por `21_rls.test.sql`, actualizar la aserción correspondiente en `21_rls.test.sql` y su `select plan(N);`.

---

## 4. Seeds y `database.types.ts`

- **`seed.sql` y `supabase/seeds/`:** usar únicamente datos sintéticos deterministas con UUIDs fijos e idempotencia básica. Validar siempre que todos los seeds corran limpios con `npx supabase db reset`.
- **`apps/admin/src/infrastructure/supabase/database.types.ts`:**
  - **Nunca** editarlo ni resolver conflictos manualmente.
  - Regenerar únicamente tras validar que la base local resetea limpio (`npm run gen:types` dentro de `apps/admin`, con `supabase start` activo).
  - Respetar la regla de `AGENT.md` de no mezclarlo en commits parciales cuando choque con ramas activas de frontend o salga sin formato.

---

## 5. Documentación obligatoria

Cada cambio en BD o contratos RPC debe actualizar con diffs mínimos (sin reformateo masivo):
- El contrato en `supabase/doc-supabase/rpcs/<rpc>.md` y su referencia en `supabase/doc-supabase/api/<modulo>.md` (incluyendo número de versión/migración).
- `supabase/doc-supabase/roles-y-permisos.md` y `supabase/doc-supabase/api/tablas-directas.md` si cambian permisos RLS o acceso directo a tablas.
- `supabase/doc-supabase/api/estado-rpcs.md` cuando se agregue o cierre un RPC.
- Los documentos funcionales en `docs/` (`requerimientos-y-reglas.md`, `flujo-operativo-mvp.md`, `trazabilidad-requerimientos-db.md`) si cambia una regla de negocio (`RN-*`).

---

## 6. Verificación antes de dar por terminada una tarea

Ejecutar desde la raíz del repositorio (en PowerShell usar `;` y validar `$LASTEXITCODE`):

1. Reconstruir desde cero migraciones y seeds:
   ```powershell
   npx supabase db reset
   ```
2. Correr la prueba puntual nueva o modificada y después toda la suite `pgTAP`:
   ```powershell
   npx supabase test db supabase/tests/<archivo>.test.sql
   npx supabase test db
   ```
   *(Debe terminar con `Result: PASS` sin archivos ni aserciones fallidas.)*
3. Si el cambio impacta tipos o adapters en `apps/admin`:
   - Regenerar tipos si cambió alguna firma (`npm run gen:types` en `apps/admin`).
   - Verificar `npx tsc -b`, `npx vitest run` y `npx oxlint` sobre los archivos tocados.
4. Revisar `git status --short` (solo lectura) para confirmar que no quedaron archivos temporales o no solicitados.
