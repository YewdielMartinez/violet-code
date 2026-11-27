# Cómo trabajamos

Equipo de 7. El jurado evalúa "participación equilibrada": **cada quien hace commits y PRs con su propia cuenta**.

## Equipos y responsables

| Área | Personas | Responsable | Carpeta |
|---|---|---|---|
| Front (Administración) | 2 | Yewdiel (líder de front) | `apps/admin`, `packages/design-tokens` |
| Datos y Backend (Supabase) | 2 | _por asignar_ | `supabase/` |
| Móvil (Android) | 2 | _por asignar_ | `apps/mobile` |
| Producto, docs, seguridad y pitch | 1 | _por asignar_ | `docs/` |

Ajustar nombres aquí cuando se definan. Cada área es responsable de probar los cambios de su carpeta antes de integrarlos.

## Ramas e integración (sin PRs hacia `develop`)

- `main` siempre compila y está lista para demo. **Nadie hace push directo a `main`.**
- La integración continua del equipo se hace en `develop`.
- Para ahorrar tiempo, **no se requieren Pull Requests hacia `develop`**: cada integrante trabaja en su rama corta (`tipo/area-descripcion`, ej. `feat/admin-bandeja-solicitudes`, `feat/supabase-rpc-expedientes`, `fix/mobile-salida-rapida`, `docs/arquitectura-hexagonal`), hace `merge` a `develop` y luego `git push`.
- **Regla obligatoria:** antes de hacer `merge` a `develop` y `push`, debes ejecutar y validar las pruebas y checks locales de tu área (ver sección siguiente).

## Commits

[Conventional Commits](https://www.conventionalcommits.org/es/) en español con el área como scope (`admin`, `supabase`, `mobile`, `docs`):

```
feat(supabase): agrega RPC para consulta de pre-registro por CURP
feat(admin): implementa adaptador y hook de directorio con arquitectura hexagonal
fix(mobile): corrige envío de ubicación en alerta de auxilio
docs(adr): documenta arquitectura hexagonal en admin
```

## Reglas de arquitectura por carpeta

1. **`apps/admin` (Arquitectura Hexagonal — ver [estandar-frontend-arquitectura.md](docs/estandar-frontend-arquitectura.md) y [ADR-0003](docs/adr/0003-arquitectura-hexagonal-admin-supabase.md)):**
   - `domain/` (`models/`, `ports/`): cero dependencias externas (sin React ni Supabase).
   - `infrastructure/supabase/`: **único** lugar que importa `client.ts` y `database.types.ts`. Un adaptador por puerto (`Supabase<Nombre>Repository.ts`), mapeando `snake_case` → `camelCase`.
   - `hooks/`: orquestación con TanStack Query contra los puertos.
   - `features/` y `shared/ui/`: pantallas y componentes con `@yewdiel21/motion-kit` + tokens semánticos de Tailwind v4 (ver [guia-motion-kit-frontend.md](docs/guia-motion-kit-frontend.md)).
2. **`supabase/` (Esquema, RLS y RPCs — ver [buenas-practicas.md](supabase/doc-supabase/buenas-practicas.md)):**
   - Todo cambio de tabla, RLS o RPC va en una migración nueva en `supabase/migrations/` (nunca cambios sueltos solo en el dashboard).
   - Si cambia el esquema o un RPC, regenerar `apps/admin/src/infrastructure/supabase/database.types.ts` y avisar a Admin y Móvil al integrar a `develop`.

## Pruebas obligatorias antes de hacer merge a `develop`

1. **`apps/admin`:** `npm run lint -w @violet-code/admin` y `npm run build -w @violet-code/admin` en verde (y pruebas unitarias con Vitest cuando aplique).
2. **`supabase/`:** `npx supabase db reset` sin errores y `npx supabase test db` en verde.
3. **`apps/mobile`:** compilación y pruebas locales sin errores.
4. Si cambias el contrato de BD/RPCs, avisa a Admin y Móvil al subir a `develop`.
5. Si tomas una decisión de arquitectura importante, agrega un ADR en `docs/adr/`.

## Reglas de datos y entorno (no negociables)

- **Solo datos sintéticos.** Nunca nombres, CURP, teléfonos, direcciones o casos reales en código, seeds, capturas ni demo.
- **Variables de entorno:**
  - Nunca subir `.env`, llaves ni contraseñas. Usar `apps/admin/.env.example` como plantilla.
  - En `apps/admin/.env` solo va `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (nunca `service_role`).
  - `supabase/` se vincula por CLI (`supabase login` + `supabase link`), sin guardar contraseñas en el repo.
- No registrar datos personales (PII) de la usuaria en logs (consola del navegador, logcat ni servidor).

## Cómo correr todo

Ver [README.md](README.md#desarrollo-local).
