# Violet Code — Supabase

Configuración y base de datos del proyecto gestionadas con **Supabase CLI**.

## Estructura

```text
supabase/
  config.toml    configuración local de Supabase (API :54321 · DB :54322 · Studio :54323)
  migrations/    migraciones SQL versionadas
  functions/     Edge Functions (Deno / TypeScript)
  tests/         pruebas SQL (pgTAP) para esquema, RPCs y RLS
  doc-supabase/  guías de buenas prácticas y pruebas
```

## Requisitos e instalación

Requiere **Docker Desktop** corriendo y **Supabase CLI**:

```sh
# Windows (Scoop) / macOS (Homebrew)
scoop install supabase          # o: brew install supabase/tap/supabase

# Alternativa con npm (global) o sin instalar (prefijando npx supabase)
npm install -g supabase
supabase --version
```

## Comandos principales

```sh
supabase start                              # levanta entorno local
supabase migration new <nombre_del_cambio>  # crea nueva migración SQL
supabase db reset                           # aplica migraciones + seed desde cero
supabase test db                            # ejecuta pruebas en supabase/tests/
supabase db push                            # aplica migraciones al proyecto remoto vinculado
supabase stop                               # detiene contenedores locales
```

## Documentación

- [Buenas prácticas (seguridad, optimización, RPCs y tipos)](doc-supabase/buenas-practicas.md)
- [Arquitectura de base de datos, esquema y RPCs](doc-supabase/esquema-y-rpcs.md)
- [Módulo de geografía y códigos postales (SEPOMEX)](doc-supabase/geografia-sepomex.md)
- [Estrategia de pruebas](doc-supabase/pruebas.md)
- Convenciones de ramas, commits y PRs: [CONTRIBUTING.md](../CONTRIBUTING.md)
