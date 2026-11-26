# 06 · Proceso posterior a la reunión

> Objetivo: convertir respuestas en artefactos de construcción **en ≤ 4 horas** tras la reunión, para empezar a codificar el Día 1 con alcance cerrado.

## Pipeline

```
Acta (R-xx) ─► Hipótesis actualizadas ─► Flujos de negocio ─► Casos de uso ─► Historias de usuario
                                              │                     │                  │
                                              ▼                     ▼                  ▼
                                        Modelo de datos      RF / RNF (MoSCoW)    Alcance MVP + backlog
                                              │
                                              ▼
                                    ADRs ─► Arquitectura definitiva
```

## Paso 0 — Consolidación (30 min, inmediatamente después)

1. Los dos relatores unifican notas en `registro/acta-AAAA-MM-DD.md`.
2. Cada respuesta recibe ID `R-xxx`, etiqueta `[C]`/`[I]` y su impacto.
3. Se marca en [hipotesis.md](registro/hipotesis.md) cada H como Confirmada / Refutada / Parcial **con su R-xx**.
4. Regla: lo que no tiene R-xx sigue siendo hipótesis. No se construye sobre hipótesis críticas (seguridad de la usuaria, auxilio) sin confirmar.

## Paso 1 — Flujos de negocio (45 min)

**Entrada:** R-xx de Q-01, Q-15, Q-21, Q-26, Q-32, Q-36.

1. Dibujar el flujo **AS-IS** exactamente como lo describieron (sin mejorarlo).
2. Dibujar el flujo **TO-BE** con Violet Code, marcando qué paso automatiza o elimina.
3. Derivar la **máquina de estados** de Solicitud, Alerta y Expediente (estados + quién cambia cada transición).
4. Formato: diagramas Mermaid en `docs/business/flujos.md` (versionables).

## Paso 2 — Casos de uso (30 min)

Por cada paso TO-BE que toca el sistema, un caso de uso:

```
CU-xx  Nombre (verbo + objeto)
Actor:            (rol confirmado)
Precondición:
Flujo principal:  1. … 2. …
Flujos alternos:  (errores, cancelación, sin conexión)
Postcondición:
Reglas:           (de R-xx)
Datos:            (entidades tocadas)
Seguridad:        (quién puede, qué se audita)
Trazabilidad:     R-xx, H-xx
```

## Paso 3 — Historias de usuario (45 min)

Plantilla:

```
HU-xx  Como <rol confirmado>, quiero <acción>, para <beneficio expresado por SEMUJERES>.
Criterios de aceptación (Gherkin):
  Dado … Cuando … Entonces …
Prioridad MoSCoW · Estimación (S/M/L) · Componente (Mobile/Admin/Core) · CU-xx · R-xx
```

Reglas:
- El "para" debe venir de un dolor registrado; si no lo hay, la historia es candidata, no compromiso.
- Una historia ≤ medio día de trabajo; si no, partirla.
- Toda historia que toque datos sensibles incluye criterio de autorización y auditoría.

## Paso 4 — Requisitos funcionales y no funcionales (30 min)

- **RF:** se agrupan casos de uso por módulo → [requerimientos.md](registro/requerimientos.md) con evidencia.
- **RNF:** de las respuestas de Seguridad, Privacidad e Infraestructura (Q-42…Q-56). Siempre **medibles**:
  - "Seguro" ✗ → "Sesión del panel expira tras 15 min de inactividad" ✓
  - "Rápido" ✗ → "Una alerta aparece en el panel en < 5 s en red local" ✓
- Lo que SEMUJERES rechazó o marcó como riesgoso → **Descartados (RD-xx)** con motivo.

## Paso 5 — Modelo de datos (45 min)

**Entrada:** formato de expediente (Q-14), reportes (Q-37, Q-41), visibilidad (Q-23), retención (Q-18).

1. Entidades y atributos **solo** de campos que aparecen en sus formatos o reportes (minimización).
2. Clasificar cada atributo: `público` · `interno` · `sensible` · `muy sensible` → define cifrado y visibilidad.
3. Verificar que cada indicador pedido (Q-37) se pueda calcular con los campos capturados.
4. ERD en Mermaid en `docs/architecture/modelo-datos.md` + asignación de entidades a schema/módulo.

## Paso 6 — Arquitectura definitiva (30 min)

1. Recorrer [decisiones-pendientes.md](registro/decisiones-pendientes.md): cerrar las que ya tienen evidencia.
2. Cada decisión cerrada → ADR `Aceptada`. Cambios respecto a la preliminar → [cambios-arquitectura.md](registro/cambios-arquitectura.md).
3. Publicar contrato **OpenAPI v0** (endpoints del MVP) antes de que Mobile y Admin empiecen.
4. Congelar: módulos Core, schemas, roles, estados. Cambios posteriores solo por ADR.

## Paso 7 — Alcance del MVP (30 min, con todo el equipo)

Criterios para que algo entre al MVP (todos deben cumplirse):

1. Evidencia de necesidad (R-xx) **o** es requisito de seguridad/privacidad.
2. Forma parte de un flujo demostrable de punta a punta.
3. Cabe en el plan de 5 días con margen del 30 %.
4. No pone en riesgo a la usuaria.

**Plan de días (propuesta, ajustar):**

| Día | Core | Admin | Mobile | Transversal |
|---|---|---|---|---|
| 1 | Solución, módulos, Identity, schemas, OpenAPI v0, Docker | Scaffold Vite + motion-kit + tema violet, login, layout | Scaffold Compose + tema, navegación, Seguridad (salida rápida) | Seeds sintéticos |
| 2 | Alertas + SignalR, Solicitudes | Bandeja de solicitudes/alertas en vivo | Auxilio + Solicitudes | Integración F1 |
| 3 | Expedientes, intervenciones, estados, auditoría | Expediente + intervenciones + asignación | Orientación + Directorio (offline) | Integración F2/F3 |
| 4 | Analítica, catálogos, seguimiento | Dashboard + estadísticas | Seguimiento / Puntos Violeta | Pruebas extremo a extremo |
| 5 | Endurecimiento, logs, demo seed | Pulido, accesibilidad | Pulido | Ensayo de demo, pitch, docs |

**Salida:** backlog priorizado (Must primero) + guion de demo con datos sintéticos.

## Definición de "listo para construir"

- [ ] Hipótesis críticas H-04, H-05, H-06 con estado distinto de "Abierta".
- [ ] D-01, D-02, D-03, D-07 decididas.
- [ ] Flujos F1–F3 TO-BE dibujados.
- [ ] Modelo de datos v1 + contrato OpenAPI v0.
- [ ] Backlog Must ≤ 70 % de la capacidad de 5 días.
