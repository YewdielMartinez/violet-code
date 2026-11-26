# Buenas prácticas de Supabase

Guía técnica genérica de seguridad, optimización, RPCs y tipado para trabajar con Supabase en el monorepo.

---

## 1. Flujo de trabajo con migraciones

- Todo cambio de esquema, política RLS, función o seed debe quedar versionado en `supabase/migrations/`.
- **No realizar cambios definitivos únicamente desde el dashboard web.**
- **No editar migraciones ya aplicadas** en `main` o en remoto; cualquier ajuste posterior se hace creando una migración nueva (`supabase migration new <nombre>`).

---

## 2. Seguridad (RLS-First)

1. **Tablas cerradas por defecto:** activar `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` inmediatamente después de crear cada tabla.
2. **Llaves:**
   - En clientes (web/móvil) usar únicamente `SUPABASE_URL` y `ANON_KEY` (o publishable key).
   - **Nunca** exponer `service_role` key en frontend, app móvil, archivos `.sql` ni en Git.
3. **Índices en RLS:** toda columna usada dentro de una política RLS (`user_id`, `role`, `tenant_id`, etc.) debe tener índice para evitar *sequential scans*.
4. **Funciones `SECURITY DEFINER`:**
   - Usarlas solo cuando una operación deba saltarse RLS de forma controlada (ej. helpers de rol o reportes agregados).
   - Fijar siempre `SET search_path = public` y validar explícitamente los permisos/rol al inicio de la función.
5. **Storage privado:** archivos sensibles van en buckets con `public = false`, políticas RLS sobre `storage.objects` y lectura mediante URLs firmadas temporales (`createSignedUrl`).
6. **Pruebas reales de RLS:** el SQL Editor del dashboard corre como `postgres` y se salta RLS. Validar siempre los permisos desde un cliente autenticado o simulando el rol/JWT en local.

---

## 3. Optimización de recursos y llamadas

- **Proyección mínima:** evitar `select('*')` por defecto; solicitar solo las columnas necesarias para la vista.
  ```ts
  const { data, error } = await supabase
    .from('items')
    .select('id, name, status, created_at')
    .range(0, 19);
  ```
- **Paginación obligatoria en listados:** usar `.range(from, to)` o `.limit(n)` respaldado por índices en PostgreSQL sobre columnas de `WHERE` y `ORDER BY`.
- **Evitar consultas N+1:** usar relaciones embebidas de PostgREST (`select('id, category(name)')`) o encapsular en un **RPC**.
- **Caché en cliente:** en web, envolver las lecturas con **TanStack Query** (`staleTime` acorde al dato) para evitar peticiones repetidas al navegar.
- **Realtime selectivo:** habilitar Realtime solo en tablas que requieran eventos en vivo, usar filtros de suscripción cuando aplique y limpiar siempre el canal al desmontar (`supabase.removeChannel(channel)`).

---

## 4. RPCs (Funciones PostgreSQL)

Un **RPC** es una función SQL creada en `supabase/migrations/` que Supabase expone automáticamente como endpoint.

### Cuándo usar RPC en lugar de `.from()`
- Agregaciones o reportes (devolver conteos/totales sin exponer filas individuales).
- Operaciones transaccionales que afectan múltiples tablas de forma atómica.
- Consultas con ordenamiento o reglas complejas de negocio.

### Cómo consumir un RPC

**Web (`@supabase/supabase-js`):**
```ts
const { data, error } = await supabase.rpc('nombre_funcion', {
  p_parametro: 'valor',
});
```

**Android (`supabase-kt`):**
```kotlin
val result = supabase.postgrest.rpc(
    function = "nombre_funcion",
    parameters = mapOf("p_parametro" to "valor")
)
```

---

## 5. Generación de tipos (`supabase gen types`)

Regenerar los tipos de TypeScript cada vez que cambie una migración para mantener contrato estricto con el frontend:

```sh
# Desde entorno local
supabase gen types typescript --local > apps/admin/src/shared/api/database.types.ts

# Desde proyecto remoto vinculado
supabase gen types typescript --linked > apps/admin/src/shared/api/database.types.ts
```

Inicializar el cliente tipado:

```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
```
