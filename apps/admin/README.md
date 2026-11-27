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

## Problemas conocidos de motion-kit

Ver [MOTION-KIT-ISSUES.md](MOTION-KIT-ISSUES.md): errores y fricciones detectados, con su parche temporal y la corrección sugerida.

## Dictado por voz local del historial clínico (RF-12, RF-12.1)

La psicóloga puede dictar en lugar de escribir en **Expedientes → Historial clínico**. El audio se transcribe **en el propio navegador** con Whisper sobre WebGPU. No hay servidor de transcripción ni proveedor externo: la voz no sale del equipo y solo se guarda en Supabase el texto que la usuaria revisa y decide guardar.

### Uso

1. **Primera sesión:** elige el campo destino (con el selector del panel de dictado o con **Dictar aquí** sobre el campo, que queda resaltado). **Nueva observación:** el destino es siempre la observación de la sesión.
2. Pulsa **Iniciar dictado** y concede el permiso del micrófono. Mientras graba, el panel muestra el aura y los puntos que siguen la voz, más un cronómetro con el límite de **5 minutos** (al llegar, se detiene solo).
3. Pulsa **Detener y transcribir**. La primera vez se descarga el modelo (con progreso por archivo); después se transcribe en el dispositivo.
4. Revisa la transcripción y elige **Añadir al campo** (se anexa al texto existente, separado por una línea en blanco, sin reemplazarlo) o **Descartar transcripción**. El texto añadido se puede corregir a mano.
5. Guarda el formulario. Mientras hay un dictado en curso, el botón de guardar está deshabilitado.

El panel muestra siempre el aviso **«No dictes CURP ni nombres propios»** (RF-12.1).

### Cómo funciona

```
MediaRecorder ──Blob──▶ OfflineAudioContext ──Float32 16 kHz mono──▶ Web Worker
 (micrófono)            (decodifica y remuestrea)                    Transformers.js + ONNX Runtime (WebGPU)
                                                                     Xenova/whisper-base · español
                                                         ◀──texto── ventanas de 30 s con 5 s de solapamiento
```

1. **Grabación** (`features/psicologia/useSpeechDictation.ts`). Hook con una máquina de estados: `inactivo → permiso → grabando → preparando-audio → cargando-modelo → transcribiendo → revision` (o `error`). Usa `getUserMedia` + `MediaRecorder` y no transcribe nada hasta que se detiene la grabación. Al detener, cancelar o salir de la pantalla, cierra las pistas del micrófono y aborta la inferencia; los resultados tardíos de una sesión cancelada se ignoran. El `MediaStream` se expone en el estado `grabando` solo para alimentar los indicadores visuales.
2. **Preparación del audio** (`infrastructure/whisper/transcribirLocal.ts`). `OfflineAudioContext` decodifica el Blob y lo remuestrea a 16 kHz mono sin abrir una salida de sonido. El buffer se **transfiere** (no se copia) al worker y se pone a ceros en cuanto deja de usarse.
3. **Inferencia** (`infrastructure/whisper/whisper.worker.ts`). Un Web Worker de módulo (`worker: { format: 'es' }` en `vite.config.ts`) crea el pipeline `automatic-speech-recognition` de `@huggingface/transformers` con `device: 'webgpu'` (encoder `fp32`, decoder `q4`). Whisper procesa ventanas de 30 s con 5 s de solapamiento para no cortar palabras y devuelve el texto. Cada dictado usa un worker nuevo que se termina al acabar.
4. **Progreso de descarga** (`infrastructure/whisper/descargas.ts` + `features/psicologia/DescargaWhisper.tsx`). Envuelve el `fetch` de Transformers para informar nombre, bytes recibidos y, cuando se conoce el tamaño, porcentaje de cada archivo. Los archivos servidos desde la caché del navegador no se anuncian como descargas.
5. **Interfaz** (`DictadoVozControl.tsx`, `EditorClinico.tsx`). Usa motion-kit (`VoiceAura`, `VoiceDots`, `Progress`, `RichTextEditor`). El editor desactiva `spellcheck` para que las narrativas no pasen por el corrector del navegador ni del sistema.

El protocolo entre la página y el worker está tipado en `infrastructure/whisper/protocol.ts`.

### Privacidad: qué se descarga y qué no sale del equipo

| Dato | Destino |
|---|---|
| Audio grabado | Solo memoria del navegador. No se guarda ni se envía a ningún servicio; se descarta al transcribir o cancelar. |
| Transcripción | Solo en pantalla hasta que se añade al campo. Llega a Supabase únicamente al guardar el formulario. |
| Archivos del modelo | Se **descargan** de Hugging Face (archivos públicos, unos 210 MB la primera vez) y el navegador los conserva en su Cache API. No se envía nada del caso. |
| Runtime de ONNX (`.wasm`/`.mjs`) | Lo empaqueta Vite y se sirve con el panel; no se ejecuta JavaScript desde un CDN. |

El modelo y su revisión están fijados (`MODELO_WHISPER` y `REVISION_WHISPER` en `whisper.worker.ts`), y `env.allowLocalModels = false`. Así siempre se usa la misma versión auditada. Para actualizar el modelo, cambia ambas constantes juntas y vuelve a probar la transcripción en español.

### Requisitos y alternativas

- Contexto seguro: HTTPS o `localhost`.
- Navegador con **WebGPU** (Chrome/Edge recientes), `MediaRecorder` y micrófono.
- Si algo falta, se deniega el permiso, falla la descarga o no se reconoce voz, el panel lo explica y **la captura manual sigue disponible**.

### Pruebas

`tests/features/psicologia/` cubre el hook de dictado (grabación hasta 5 min, cancelación, micrófono denegado), el control (aviso RF-12.1, insertar o descartar), el editor (anexar sin interpretar HTML) y el progreso de descarga. `tests/infrastructure/whisper/` cubre el observador de descargas. La transcripción real requiere un navegador con WebGPU y se valida a mano con el usuario `psicologia` del seed.
