# Guía de Consumo de Supabase para Frontend (RPCs y PostgREST)

Esta guía explica cómo deben consumir el backend (**RPCs**, **tablas/vistas PostgREST** y **Storage**) los desarrolladores de **Frontend (`apps/admin`)** sin hacer llamadas directas desde los componentes ni provocar problemas de rendimiento.

> Complementa a [`estandar-servicios-y-rpcs.md`](./estandar-servicios-y-rpcs.md) y [`estandar-frontend-arquitectura.md`](./estandar-frontend-arquitectura.md).

---

## 1. Regla de oro en Frontend

**Los componentes React (`.tsx`) NUNCA importan `supabase` directamente.**

El flujo siempre es:
```text
Componente (.tsx) -> Hook de api.ts (TanStack Query) -> Adapter (Supabase*Repository.ts) -> Supabase (RPC / REST)
```

- **En `features/<modulo>/api.ts`:** solo hooks (`useQuery`, `useMutation`) y manejo de caché (`queryKey`).
- **En `infrastructure/supabase/adapters/`:** única capa autorizada para usar `supabase.rpc(...)` o `supabase.from(...)`, mapear `snake_case <-> camelCase` y propagar errores.

---

## 2. Cómo consumir un RPC (`supabase.rpc`)

Usa `supabase.rpc` para operaciones transaccionales, búsquedas complejas o vistas protegidas:

```ts
const { data, error } = await supabase.rpc('crear_ficha_completa', {
  p_payload: payload as unknown as Json,
});

if (error) throw error;
```

### RPCs disponibles actualmente en Supabase

| RPC | Quién puede llamarlo | Qué recibe | Qué devuelve |
| :--- | :--- | :--- | :--- |
| **`crear_ficha_completa`** | `titular`, `subdireccion`, `trabajo_social` | `{ p_payload: { identidad, domicilio, estudio } }` | `[{ ficha_id, folio, persona_id }]` |
| **`buscar_pre_registro_por_curp`** | `titular`, `subdireccion`, `trabajo_social` | `{ p_curp: string }` | Datos precargados de `pre_registro` (máx. 1 fila) |
| **`registrar_consulta`** | Personal activo o `umeca` activo | `{ p_tabla: string, p_registro_id: string }` | `void` (inserta evento `'ver'` en `bitacora_acceso`) |
| **`get_umeca_citas`** | `umeca`, `titular`, `subdireccion` | *(sin parámetros)* | Citas UMECA sin exponer PII completa |
| **`get_mapa_calor_asentamiento`** | Personal activo | `{ p_umbral_minimo?: number }` (default `3`) | Conteos agregados por asentamiento (`>= umbral`) |

---

## 3. Cómo consumir tablas y vistas por PostgREST (`.from()`)

Solo para catálogos simples o consultas de una tabla que no justifiquen un RPC:

1. **Prohibido `select('*')` sin límite.** Especifica únicamente las columnas que necesitas.
2. **Siempre pon `.limit(...)`** en listados para evitar traer miles de filas.
3. **Usa joins embebidos con cuidado** y maneja el resultado sabiendo que PostgREST puede devolver objeto o arreglo según la relación.
4. **No filtres colecciones grandes en JavaScript** cuando exista un índice en PostgreSQL (`curp`, `folio`, `codigo_postal`).

```ts
const { data, error } = await supabase
  .from('cat_area')
  .select('id, clave, nombre')
  .order('nombre')
  .limit(50);

if (error) throw error;
```

---

## 4. Manejo de errores de Supabase en Frontend

Nunca ocultes el error real dentro de un `catch` vacío. Los códigos más comunes que devuelve Postgres/PostgREST son:

| Código (`error.code`) | HTTP | Significado | Qué mostrar en UI |
| :--- | :---: | :--- | :--- |
| **`42501`** | `401` / `403` | Sin permiso RLS o rol no autorizado | Mensaje de permisos insuficientes |
| **`23514`** | `400` | Falla una regla de negocio o `CHECK` | Mostrar `error.message` en el campo/alerta |
| **`23505`** | `409` | Registro duplicado (ej. CURP ya registrada) | Mostrar `error.message` (incluye el folio si aplica) |
| **`PGRST116`** | `406` | `.single()` esperaba 1 fila y recibió 0 | Usar `.maybeSingle()` cuando pueda no existir |

Ejemplo de extracción segura en `onSubmit`:
```ts
const msg =
  typeof err === 'object' &&
  err !== null &&
  'message' in err &&
  typeof (err as { message: unknown }).message === 'string'
    ? (err as { message: string }).message
    : 'Ocurrió un error al procesar la solicitud.';
```

---

## 5. Buenas prácticas de rendimiento (TanStack Query)

1. **`staleTime` alto en catálogos:** `cat_area`, `cat_ocupacion`, `cat_parentesco`, `directorio_institucion` casi no cambian; usa `staleTime` de 30 minutos para no pedirlos en cada apertura de modal.
2. **Queries condicionales con `enabled`:** si un diálogo o tab está cerrado, no dispares el query hasta que `open === true` o `Boolean(fichaId)`.
3. **Invalidación precisa:** al mutar una derivación o un agresor de un expediente, invalida únicamente las keys afectadas (`['derivaciones']`, `['expedientes', 'agresores', fichaId]`), no todo el caché global.
4. **Cero PII en logs o almacenamiento:** nunca hagas `console.log` de `curp`, nombres o payloads completos ni los guardes en `localStorage`.
