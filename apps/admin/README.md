# Violet Code Administration

Panel web de SEMUJERES. React 19 + TypeScript + Vite + **Tailwind v4** + **motion-kit**.

```sh
npm run dev -w @violet-code/admin     # http://localhost:5173 (conectado directo a Supabase)
npm run lint -w @violet-code/admin
npm run build -w @violet-code/admin
```

## Estructura (por feature)

```
src/
  app/            router, layout, navegación (navigation.ts = mapa de módulos)
  features/
    dashboard/    indicadores
    directory/    directorio y Puntos Violeta (ejemplo completo: api.ts + página)
    <modulo>/     api.ts (hooks TanStack Query) + páginas + componentes del módulo
  shared/
    api/          cliente HTTP (token en memoria)
    ui/           componentes propios reutilizables
```

**Agregar un módulo:** crear `src/features/<modulo>/`, registrar la página en `app/router.tsx` y marcar `ready: true` en `app/navigation.ts`.

## Estilos

- **Componentes complejos** (tablas, gráficas, navegación, estados vacíos, diálogos): `@yewdiel21/motion-kit/react`.
- **Layout y estilos propios:** Tailwind. Los colores de Tailwind son los del tema: `bg-primary`, `text-on-surface`, `bg-surface-container`, `border-outline-variant`, `bg-error-container`…
- **No usar colores de la paleta por defecto de Tailwind** (`bg-purple-500`, etc.): rompen el modo oscuro y el tema.

## Dictado por voz local del historial clínico (RF-12, RF-12.1)

Al editar el **Historial clínico** de un expediente, Psicología puede dictar en lugar de escribir. El audio se transcribe **en el propio navegador** con Whisper sobre WebGPU. No hay servidor de transcripción ni proveedor externo: la voz no sale del equipo y a Supabase solo llega el texto que la psicóloga revisa y guarda con `guardar_historial_clinico` (el mismo RPC, permisos y versionado que la captura manual).

### Uso

1. Abre el expediente → **Historial clínico** → **Editar** (o **Registrar historial clínico**). Solo lo ve el rol `psicologia`; Titular y Subdirección solo leen.
2. Elige el campo destino con **Dictar aquí** (queda marcado como *Destino del dictado*; por defecto es *Motivo de consulta*).
3. Pulsa **Iniciar dictado** y concede el micrófono. Mientras graba se ven el aura, los puntos que siguen la voz y un cronómetro con el límite de **5 minutos** (al llegar, se detiene solo).
4. Pulsa **Detener y transcribir**. La primera vez se descarga el modelo (con progreso por archivo); después se transcribe en el dispositivo.
5. Revisa la transcripción y elige **Añadir al campo** (se anexa al texto, separado por una línea en blanco, sin reemplazarlo; se recorta si pasaría de 5,000 caracteres) o **Descartar transcripción**.
6. Guarda el historial. Mientras hay un dictado en curso, **Guardar historial** está deshabilitado; cancelar la edición descarta el dictado y cierra el micrófono.

El aviso **«No dictes CURP ni nombres propios»** está siempre visible (RF-12.1) y los campos tienen `spellcheck` desactivado para que las narrativas no pasen por el corrector del navegador o del sistema.

### Cómo funciona

```
MediaRecorder ──Blob──▶ OfflineAudioContext ──Float32 16 kHz mono──▶ Web Worker
 (micrófono)            (decodifica y remuestrea)                    Transformers.js + ONNX Runtime (WebGPU)
                                                                     Xenova/whisper-base · español
                                                         ◀──texto── ventanas de 30 s con 5 s de solapamiento
```

1. **Grabación** (`features/dictado-voz/useSpeechDictation.ts`). Máquina de estados `inactivo → permiso → grabando → preparando-audio → cargando-modelo → transcribiendo → revision` (o `error`). Al detener, cancelar o desmontar, cierra las pistas del micrófono y aborta la inferencia; los resultados tardíos de una sesión cancelada se ignoran.
2. **Preparación del audio** (`infrastructure/whisper/transcribirLocal.ts`). `OfflineAudioContext` remuestrea a 16 kHz mono sin abrir salida de sonido. El buffer se **transfiere** al worker y se pone a ceros al dejar de usarse.
3. **Inferencia** (`infrastructure/whisper/whisper.worker.ts`). Worker de módulo (`worker: { format: 'es' }` en `vite.config.ts`) con el pipeline `automatic-speech-recognition` de `@huggingface/transformers`, `device: 'webgpu'` (encoder `fp32`, decoder `q4`). Cada dictado usa un worker nuevo que se termina al acabar.
4. **Progreso de descarga** (`infrastructure/whisper/descargas.ts` + `features/dictado-voz/DescargaWhisper.tsx`). Envuelve el `fetch` de Transformers para informar bytes por archivo; lo servido desde caché no se anuncia como descarga.
5. **Interfaz** (`features/dictado-voz/DictadoVozControl.tsx`, integrado en `features/expedientes/HistorialClinicoPanel.tsx`). Usa `VoiceAura`, `VoiceDots` y `Progress` de motion-kit. `features/dictado-voz/unirDictado.ts` anexa el texto sin reemplazar lo escrito.

### Privacidad: qué se descarga y qué no sale del equipo

| Dato | Destino |
|---|---|
| Audio grabado | Solo memoria del navegador. No se guarda ni se envía; se descarta al transcribir o cancelar. |
| Transcripción | Solo en pantalla hasta que se añade al campo. Llega a Supabase únicamente al guardar el historial. |
| Archivos del modelo | Se **descargan** de Hugging Face (públicos, unos 210 MB la primera vez) y quedan en la Cache API del navegador. No se envía nada del caso. |
| Runtime de ONNX (`.wasm`/`.mjs`) | Lo empaqueta Vite y se sirve con el panel; no se ejecuta JavaScript desde un CDN. |

El modelo y su revisión están fijados (`MODELO_WHISPER` y `REVISION_WHISPER` en `whisper.worker.ts`) y `env.allowLocalModels = false`. Para actualizar el modelo, cambia ambas constantes juntas y vuelve a probar la transcripción en español.

### Requisitos y alternativas

- Contexto seguro: HTTPS o `localhost`.
- Navegador con **WebGPU** (Chrome/Edge recientes), `MediaRecorder` y micrófono.
- Si algo falta, se deniega el permiso, falla la descarga o no se reconoce voz, el panel lo explica y **la captura manual sigue disponible**.

### Pruebas

`tests/features/dictado-voz/` cubre el hook (grabación hasta 5 min, cancelación, micrófono denegado), el control (aviso RF-12.1, insertar o descartar), el progreso de descarga y `unirDictado`. `tests/features/expedientes/HistorialClinicoDictado.test.tsx` cubre la integración con el panel (solo Psicología, campo destino, guardado por RPC, guardar bloqueado durante el dictado). `tests/infrastructure/whisper/` cubre el observador de descargas. La transcripción real requiere un navegador con WebGPU y se valida a mano con el usuario `psicologia` del seed.

## Problemas conocidos de motion-kit

Ver [MOTION-KIT-ISSUES.md](MOTION-KIT-ISSUES.md): errores y fricciones detectados, con su parche temporal y la corrección sugerida.
