# Cómo trabajamos

Equipo de 7. El jurado evalúa "participación equilibrada": **cada quien hace commits y PRs con su propia cuenta**.

## Equipos y responsables

| Área | Personas | Responsable | Carpeta |
|---|---|---|---|
| Front (Administración) | 2 | Yewdiel (líder de front) | `apps/admin` |
| Backend (Core) | 2 | _por asignar_ | `apps/core` |
| Móvil (Android) | 2 | _por asignar_ | `apps/mobile` |
| Producto, docs, seguridad y pitch | 1 | _por asignar_ | `docs/` |

Ajustar nombres aquí cuando se definan. Cada área revisa los PRs de su carpeta.

## Ramas

- `main` siempre compila y está lista para demo. **Nadie hace push directo a `main`.**
- Ramas cortas desde `main`: `tipo/area-descripcion`
  - `feat/admin-bandeja-solicitudes`
  - `feat/core-modulo-alertas`
  - `fix/mobile-salida-rapida`
  - `docs/acta-reunion-semujeres`

## Commits

[Conventional Commits](https://www.conventionalcommits.org/es/) con el área como scope:

```
feat(core): crea alerta de auxilio con ubicación
fix(admin): corrige filtro por área en expedientes
docs(discovery): registra respuestas de la reunión
```

## Pull requests

1. Un PR = un cambio revisable (idealmente < 400 líneas).
2. CI en verde (`.github/workflows/ci.yml`).
3. Al menos **1 aprobación** de otra persona.
4. Si cambia el contrato de la API, avisar a Admin y Móvil en el PR.
5. Si toma una decisión de arquitectura, agregar un ADR en `docs/adr/`.

## Reglas de datos (no negociables)

- **Solo datos sintéticos.** Nunca nombres, teléfonos, direcciones o casos reales en código, seeds, capturas ni demo.
- Nunca subir `.env`, llaves ni contraseñas. Usar `.env.example`.
- No registrar datos de la usuaria en logs (backend, logcat ni consola del navegador).

## Cómo correr todo

Ver [README.md](README.md#desarrollo-local).
