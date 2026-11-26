# Reglas para Agentes (`AGENT.md`)

Instrucciones operativas obligatorias para cualquier agente que trabaje en **Violet Code** (`apps/admin`, `supabase/`, `docs/`).

---

## 1. Base de datos y `supabase/`

- **`npx supabase db reset` desde cero en Docker sano:** toda migración o seed nuevo debe validarse desde cero con `npx supabase db reset` seguido de `npx supabase test db` en un entorno con Docker sano (incluyendo `storage-api`), confirmando que todas las migraciones y seeds corren limpios antes de cerrar la tarea.
  - Si el Docker local presenta fallos en `storage` y solo se pudo validar parcialmente, **reportarlo explícitamente** para que alguien con Docker sano ejecute `db reset` + `test db` antes de integrar a `develop`.
- **Migraciones inmutables:** nunca editar migraciones ya aplicadas en remoto / `develop`; cualquier ajuste va en una migración nueva.
- **Pruebas `pgTAP`:** todo archivo `supabase/tests/*.test.sql` debe iniciar con `create extension if not exists pgtap with schema extensions;` para que funcione tras un `db reset` en limpio.
- **Permisos RBAC:** en RPCs nuevos o modificados, validar permisos con `public.tiene_permiso('<clave>')` (no con `e.rol in (...)` escrito a mano), salvo UMECA (`es_umeca()`) y usuaria móvil (`auth.uid()`).

---

## 2. `database.types.ts`

- **No incluir `apps/admin/src/infrastructure/supabase/database.types.ts` en commits parciales** si la generación dejó el archivo sin formato (`oxfmt`) o alteró bloques requeridos por `supabase-js`, o si choca con ramas activas de frontend: sacarlo con `git restore apps/admin/src/infrastructure/supabase/database.types.ts` y regenerarlo tras integrar en `develop`.
- Nunca editar ni resolver conflictos de `database.types.ts` manualmente; siempre regenerar con `supabase gen types typescript` y formatear si aplica.

---

## 3. Seguridad y control de archivos

- **Cero credenciales o usuarios personales de prueba en el repo:** nunca crear ni versionar usuarios ad-hoc en `supabase/snippets/`, `migrations/` o `seed.sql`.
- Mantener `supabase/snippets/`, `.env` y `.env.local` fuera de Git (`.gitignore`).
- Antes de hacer `git add` o `commit`, revisar `git status --short` para asegurar que no entren archivos temporales ni `.env`.
