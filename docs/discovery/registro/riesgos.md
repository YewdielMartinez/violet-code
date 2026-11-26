# Registro de riesgos

Probabilidad / Impacto: `Alta` · `Media` · `Baja`

| ID | Tipo | Riesgo | Prob. | Impacto | Mitigación | Disparador | Responsable | Estado |
|---|---|---|---|---|---|---|---|---|
| K-01 | Seguridad usuaria | El agresor descubre la app o sus notificaciones. | Media | Alta | Ícono/nombre neutro, salida rápida, PIN, push sin contenido, sin historial. | Q-45 | Mobile | Abierto |
| K-02 | Producto / ético | El botón de auxilio crea falsa expectativa de rescate. | Alta | Alta | Priorizar 911, textos claros, confirmar capacidad de respuesta (D-01). | Q-26, Q-27 | Producto | Abierto |
| K-03 | Privacidad | Fuga de datos sensibles de expedientes. | Media | Alta | Datos sintéticos, cifrado, autorización por recurso, auditoría de lecturas. | — | Core | Abierto |
| K-04 | Alcance | Demasiados módulos para 5 días: nada queda completo. | Alta | Alta | Priorizar flujo F1→F3 de punta a punta; recortar tras reunión. | Día 1 | Equipo | Abierto |
| K-05 | Descubrimiento | Construir sobre procesos supuestos. | Media | Alta | Validar con actas; canal de consulta durante la semana (Q-68). | — | BA | Abierto |
| K-06 | Técnico | Integración Mobile↔Core↔Admin tardía (contratos cambian). | Media | Media | Contrato OpenAPI desde Día 1; mocks; cliente generado. | — | Arquitectura | Abierto |
| K-07 | Técnico | Tiempo real (SignalR) o push (FCM) fallan en la demo. | Media | Media | Fallback a polling; demo en red controlada. | — | Core | Abierto |
| K-08 | Adopción | El personal percibe el sistema como doble trabajo. | Media | Media | Evitar doble captura; formularios cortos; validar con ellas/ellos. | Q-60, Q-61 | Producto | Abierto |
| K-09 | Operación | Nadie mantiene el sistema después del hackathon. | Alta | Media | Stack simple, Docker, documentación de operación. | Q-56 | Equipo | Abierto |
| K-10 | Legal | Incumplir normatividad de datos personales. | Media | Alta | Validar con área jurídica; aviso de privacidad; nada en producción con datos reales. | Q-47 | BA | Abierto |
| K-11 | Dependencia / Licencia | motion-kit se publica como `UNLICENSED`. Si el piloto pasa a SEMUJERES, hará falta una licencia de uso institucional (convocatoria §VI). | Baja | Media | El autor del paquete es del equipo: definir la licencia antes de la transferencia. | Transferencia | Diseño | Abierto |
| K-13 | Calendario | La convocatoria trae fechas contradictorias (23–27 nov en el encabezado; 09–13 nov en el cronograma). | Media | Alta | Confirmar con la organización la fecha del pitch y del corte de código. | Ya | Representante | Abierto |
| K-14 | Evaluación | Proyecto abarca Ejes 1 y 3; la convocatoria pide inscribirse en **uno**. | Media | Media | Confirmar el eje registrado y presentar el otro como complemento. | Ya | Representante | Abierto |
| K-15 | Evaluación | La rúbrica penaliza "pantallas estáticas simuladas". | Media | Alta | Todo lo que se muestre en la demo debe venir del API real con datos sintéticos. | Día 5 | Equipo | Abierto |
| K-12 | Diseño | motion-kit es web; Mobile no puede reutilizar componentes, solo tokens. | Alta | Baja | Tokens compartidos (`VioletColors.kt`) + replicar 2–3 microinteracciones clave en Compose. | — | Mobile | Abierto |
