# Violet Code — Supabase (Base de datos, Seguridad y BaaS)

Guía de buenas prácticas, seguridad, optimización y consumo para el equipo (**Backend, Admin y Móvil**).

---

## 1. Flujo de trabajo (Supabase CLI)

**Regla:** Todo cambio de esquema, política RLS, función o seed debe quedar versionado en Git. **No hacer cambios definitivos solo desde el dashboard web.** Una vez que una migración ya se aplicó en `main` o en remoto, no se edita: cualquier ajuste se hace creando una migración nueva.

```sh
# Levantar entorno local (API :54321 · DB :54322 · Studio http://127.0.0.1:54323)
supabase start

# Crear una nueva migración SQL
supabase migration new nombre_del_cambio

# Aplicar migraciones + seed sintético desde cero (verifica que todo corre limpio)
supabase db reset

# Detener contenedores locales
supabase stop
```

Para subir cambios a un proyecto remoto vinculado (`supabase link`):

```sh
supabase db push
```

---

## 2. Seguridad (RLS-First)

1. **Toda tabla nace cerrada:** inmediatamente después de `CREATE TABLE`, activar `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`. Sin políticas explícitas, nadie puede leer ni escribir.
2. **Llaves:**
   - En `apps/admin` y `apps/mobile` usar **únicamente** `SUPABASE_URL` y `ANON_KEY` (o publishable key).
   - **Nunca** incluir `service_role` key en el frontend, la app móvil, archivos `.sql` ni en Git.
3. **Funciones `SECURITY DEFINER`:**
   - Usarlas solo cuando una consulta deba saltarse RLS de forma controlada (ej. helpers de rol o reportes agregados sin datos personales).
   - Fijar siempre `SET search_path = public` y validar el rol/permisos del usuario al inicio de la función.
4. **Storage privado:**
   - Documentos o imágenes sensibles van en buckets con `public = false`, protegidos con políticas RLS en `storage.objects` y leídos con URLs firmadas temporales (`createSignedUrl`).
5. **Solo datos sintéticos:** `supabase/seed.sql` nunca debe contener nombres, teléfonos, CURP, direcciones ni casos reales.
6. **Pruebas de RLS reales:** el SQL Editor del Dashboard ejecuta como `postgres` (se salta RLS). Validar siempre los permisos desde el cliente autenticado o simulando el rol/JWT en local.

---

## 3. Optimización de recursos y llamadas

Pensado para mantener tiempos rápidos de respuesta, evitar consumo innecesario en el plan gratuito/piloto y escalar bien:

- **Proyección mínima (nunca `select('*')` por defecto):** pedir solo las columnas que la pantalla necesita.
  ```ts
  // Bien
  const { data, error } = await supabase
    .from('tabla')
    .select('id, folio, status, created_at')
    .range(0, 19);
  ```
- **Paginación obligatoria en listados:** usar `.range(from, to)` o `.limit(n)` junto con índices en PostgreSQL sobre las columnas de filtro, ordenamiento (`WHERE`, `ORDER BY`) y las usadas dentro de políticas **RLS** (`user_id`, `role`, etc.).
- **Sin consultas N+1:** si necesitas datos relacionados, usar *joins* declarativos de PostgREST (`select('id, detalle(campo)')`) o encapsularlo en un **RPC**.
- **Caché en cliente (`apps/admin`):** consumir Supabase a través de **TanStack Query** (`useQuery` / `useMutation`) con un `staleTime` razonable (ej. 30–60 s para catálogos/tableros) para no repetir llamadas idénticas al navegar.
- **Realtime solo donde aporta valor:** activar Realtime únicamente en tablas de eventos en vivo (ej. alertas), suscribirse con filtro si aplica (`filter`) y siempre limpiar la suscripción al desmontar (`supabase.removeChannel(channel)`).

---

## 4. RPCs (Funciones PostgreSQL)

Un **RPC** es una función SQL creada por Backend en `supabase/migrations/` que Supabase expone automáticamente como endpoint seguro.

### Cuándo usar RPC en lugar de `.from()`
- Reportes o estadísticas agregadas (devolver solo conteos sin exponer filas individuales).
- Operaciones que modifican varias tablas en una sola transacción atómica.
- Consultas con ordenamiento/reglas complejas (ej. prioridad + lista de espera).

### Cómo consumir un RPC

**Web (`apps/admin` con `@supabase/supabase-js`):**
```ts
const { data, error } = await supabase.rpc('nombre_funcion', {
  p_parametro: 'valor',
});
```

**Android (`apps/mobile` con `supabase-kt`):**
```kotlin
val result = supabase.postgrest.rpc(
    function = "nombre_funcion",
    parameters = mapOf("p_parametro" to "valor")
)
```

---

## 5. Generación de tipos (`supabase gen types`)

Cada vez que se agregue o modifique una migración, regenerar los tipos de TypeScript para que `apps/admin` tenga autocompletado y detección de errores en compilación:

```sh
# Desde entorno local
supabase gen types typescript --local > apps/admin/src/shared/api/database.types.ts

# O desde proyecto remoto vinculado
supabase gen types typescript --linked > apps/admin/src/shared/api/database.types.ts
```

Luego tipar el cliente al inicializarlo:

```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
```

---

## 6. Convenciones de commits y PRs

Seguir [CONTRIBUTING.md](../CONTRIBUTING.md):
- Ramas: `feat/supabase-<descripcion>`, `fix/supabase-<descripcion>`, `chore/supabase-<descripcion>`.
- Commits: `feat(supabase): ...`, `fix(supabase): ...`, `docs(supabase): ...`.
- Si una migración o RPC cambia nombres de tablas, columnas o parámetros, **avisar en el PR** a los equipos de `apps/admin` y `apps/mobile` y regenerar los tipos.
