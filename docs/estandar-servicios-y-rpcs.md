# Estándar de Servicios y RPCs (Backend Supabase + Capa de Dominio)

Este documento define la forma estándar de trabajar servicios, RPCs y contratos de datos en **Violet Code** para evitar consultas lentas, duplicidad de lógica y conflictos en `develop`.

**Regla general:** primero se diseña y prueba la capa de **RPC + Servicio (TypeScript)**; las pantallas solo consumen los hooks de `api.ts`.

---

## 1. Flujo de trabajo en Git

1. **Nunca trabajar directo en `develop` ni en `main`.**
2. Antes de empezar una tarea, actualizar `develop` y crear **una rama por feature o módulo**:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feat/<modulo-o-servicio>
   ```
3. Hacer commits atómicos con [Conventional Commits](https://www.conventionalcommits.org/) (`feat(supabase,admin): ...`, `fix(supabase): ...`) dentro de esa rama.
4. **Solo cuando la feature/servicio esté completo y con todas las validaciones en verde**, integrarlo en `develop`.

---

## 2. Cuándo usar RPC vs consulta REST directa

| Caso | Qué usar | Motivo |
| :--- | :--- | :--- |
| Alta/edición que toca **2 o más tablas** | **RPC atómico** | Evita registros huérfanos o estados a medias si falla un paso. |
| Búsqueda/listado con **filtros, joins o paginación** | **RPC de consulta** | 1 sola ida a BD usando índices (`curp`, `folio`, `pg_trgm`), sin filtrar en el navegador. |
| Detalle completo de un expediente o vista | **RPC (`jsonb` o `table`)** | Reemplaza 3–5 llamadas REST paralelas por 1 sola petición. |
| Cambio de estado con reglas de rol o transición | **RPC** | Garantiza validación de rol y bitácora en BD. |
| Catálogo simple o 1 tabla sin joins pesados | **PostgREST (`.from()`)** | Siempre con columnas explícitas y `.limit(...)`. **Prohibido** `select('*')` sin límite. |

---

## 3. Estándar para crear un RPC en Supabase

### 3.1 Numeración de migraciones
1. Antes de crear un `.sql`, verificar las migraciones locales y remotas:
   ```bash
   git fetch origin
   npx supabase migration list
   ```
2. Crear el archivo en `supabase/migrations/` con formato `<YYYYMMDDHHMMSS>_<NN>_<nombre>.sql` usando el siguiente número consecutivo respecto a `develop` y al remoto.

### 3.2 Plantilla obligatoria de un RPC
Todo RPC debe cumplir:
- `language plpgsql`, `security definer` y `set search_path = public`.
- Validación explícita de `auth.uid()` y rol activo en `public.empleado` (`errcode = '42501'` si no tiene permiso).
- Validaciones de negocio antes de escribir (`errcode = '23514'` para datos inválidos, `errcode = '23505'` para duplicados/conflictos) con mensajes claros en español.
- **Alias obligatorio en todas las tablas (`p.id`, `f.persona_id`, `d.es_actual`)** para evitar errores de `column reference "..." is ambiguous` cuando el RPC usa `RETURNS TABLE`.
- Privilegios mínimos: `revoke execute ... from public, anon;` y `grant execute ... to authenticated;`.

```sql
create or replace function public.mi_rpc(p_payload jsonb)
returns table (
  id uuid,
  resultado text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  -- 1. Validar actor y rol activo
  if v_actor_id is null or not exists (
    select 1
    from public.empleado e
    where e.id = v_actor_id
      and e.activo
      and e.rol in ('titular', 'subdireccion', 'trabajo_social')
  ) then
    raise exception 'Sin permiso para realizar esta operación' using errcode = '42501';
  end if;

  -- 2. Validar entrada y reglas de negocio (23514 / 23505)
  -- 3. Ejecutar consultas o escrituras usando alias en TODAS las tablas
end;
$$;

revoke execute on function public.mi_rpc(jsonb) from public, anon;
grant  execute on function public.mi_rpc(jsonb) to authenticated;
```

### 3.3 Tipos TypeScript de Supabase
Si la migración agrega o modifica tablas, enums o RPCs, regenerar los tipos en `apps/admin`:
```bash
npx supabase gen types typescript --linked > apps/admin/src/infrastructure/supabase/database.types.ts
```

---

## 4. Estándar de Servicios en `apps/admin` (sin tocar pantallas)

Cada módulo se estructura en 4 piezas siguiendo arquitectura hexagonal:

1. **Modelo y validaciones puras** (`apps/admin/src/domain/models/<Entidad>.ts`):
   - Interfaces de entrada/salida, `ENUM`s tipados desde `database.types.ts`, labels y funciones `validate<Entidad>()`.
   - Cero imports de Supabase o React.
2. **Puerto / Contrato** (`apps/admin/src/domain/ports/<Entidad>Repository.ts`):
   - Define la interfaz `<Entidad>Repository` con los métodos exactos que usará la app.
3. **Adaptador Supabase** (`apps/admin/src/infrastructure/supabase/adapters/Supabase<Entidad>Repository.ts`):
   - Llama a `supabase.rpc(...)` (o `.from(...)` acotado) y mapea `snake_case -> camelCase`.
   - Propaga el error de Supabase sin ocultarlo.
4. **Hooks de consumo** (`apps/admin/src/features/<modulo>/api.ts`):
   - Expone `useQuery` / `useMutation` de TanStack Query con `queryKey` claras e invalidación mínima necesaria (sin invalidar listas globales innecesariamente).

### Ejemplo de contrato mínimo antes de programar
Antes de escribir código de un servicio nuevo, documentar en el PR/tarjeta estos 4 puntos:
- **Nombre del RPC / método:** ej. `buscar_expedientes`
- **Actores autorizados:** ej. `titular`, `subdireccion`, `trabajo_social`, `psicologia`, `juridico`
- **Entrada (`payload` / parámetros):** tipos exactos y obligatorios
- **Salida y errores esperados:** estructura de respuesta y códigos (`42501`, `23514`, `23505`)

---

## 5. Checklist de verificación (DoD) antes de pasar a `develop`

1. Migración aplicada y verificada sin conflictos (`npx supabase db push`).
2. Pruebas unitarias de modelo y adaptador en verde:
   ```bash
   npm run test -w @violet-code/admin
   ```
3. Linter limpio (0 advertencias, 0 errores):
   ```bash
   npm run lint -w @violet-code/admin
   ```
4. Compilación TypeScript + Vite limpia:
   ```bash
   npm run build -w @violet-code/admin
   ```
5. Cero PII en logs/consola y cero secretos en el repositorio.
