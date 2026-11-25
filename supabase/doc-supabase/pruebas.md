# Estrategia de pruebas en Supabase

Guía genérica de pruebas para base de datos, seguridad RLS, Edge Functions y flujos de extremo a extremo.

---

## 1. Tipos de pruebas recomendadas

1. **Integración de Base de Datos y RLS (`pgTAP` vía `supabase test db`):**
   - Son las pruebas más críticas en Supabase.
   - Verifican en PostgreSQL: estructura de tablas, `CHECK` constraints, triggers, RPCs y **políticas RLS** bajo distintos roles (`anon`, `authenticated`, roles específicos).
   - Se ubican en `supabase/tests/*.sql`.
2. **Pruebas Unitarias:**
   - **Edge Functions:** `deno test` para lógica pura de negocio, validaciones y transformaciones sin depender de red.
   - **Clientes:** pruebas unitarias de casos de uso, validadores y mappers en Web (`vitest`) y Android (`./gradlew test`).
3. **Pruebas End-to-End (E2E):**
   - Validan los flujos completos cliente ↔ Supabase (Auth + PostgREST/RPC + Realtime + Storage) contra el entorno local (`supabase start`).

---

## 2. Qué cubrir: Camino feliz, Camino no feliz y Edge Cases

### A. Seguridad y RLS
- **Camino feliz:** el usuario autenticado con el rol autorizado puede leer y escribir sus registros permitidos.
- **Camino no feliz:**
  - Usuario `anon` intentando leer o escribir tablas protegidas → rechazado / `0` filas.
  - Usuario con rol A intentando leer/modificar recursos exclusivos del rol B → rechazado / `0` filas.
  - Cualquier cliente intentando modificar o borrar registros de auditoría inmutables → rechazado.
- **Edge cases:** usuario autenticado pero desactivado (`active = false`), token expirado o claims nulos en el JWT.

### B. Integridad, Triggers y RPCs
- **Camino feliz:** inserción válida dispara triggers esperados (ej. `updated_at`, códigos autogenerados) y RPC devuelve el formato esperado.
- **Camino no feliz:**
  - Valores fuera de rango (`CHECK`), nulos en columnas `NOT NULL` o llaves foráneas inexistentes.
  - Llamar un RPC sin el rol requerido → error de autorización (`42501`).
- **Edge cases:**
  - Inserciones concurrentes que generan identificadores secuenciales (no deben colisionar).
  - RPCs de agregación cuando no hay registros en el rango consultado (devolver `0` o `{}`, nunca `null` inesperado).
  - Umbrales mínimos en consultas agregadas para evitar inferencia de registros individuales.

### C. Consultas, Paginación y Realtime
- **Camino feliz:** paginación devuelve el bloque exacto y Realtime entrega eventos filtrados en tiempo real.
- **Camino no feliz:** pérdida de red o credenciales inválidas manejadas con error controlado en cliente.
- **Edge cases:**
  - Listado vacío, página fuera de rango o tamaño de página mayor al `max_rows` configurado.
  - Campos opcionales nulos (ej. coordenadas o teléfono ausentes) no deben bloquear el flujo principal.
  - Doble envío rápido en acciones críticas (idempotencia o bloqueo en UI).

---

## 3. Ejecución local

```sh
# Levantar entorno local
supabase start

# Ejecutar pruebas SQL (pgTAP) en supabase/tests/
supabase test db

# Resetear BD + migraciones + seeds antes de pruebas E2E
supabase db reset
```
