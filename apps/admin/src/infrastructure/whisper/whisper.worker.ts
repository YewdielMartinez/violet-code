import { env, pipeline } from '@huggingface/transformers';
import wasm from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url';
import mjs from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url';
import { observarDescargasWhisper } from './descargas';
import type { WhisperMensaje } from './protocol';

const MODELO_WHISPER = 'Xenova/whisper-base';
const REVISION_WHISPER = '64da57285918e20ea79ea5c88eed7197933abaa8';

// Servir el runtime junto con el panel, sin ejecutar módulos JavaScript desde un CDN.
if (env.backends.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = { mjs, wasm };
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.proxy = false;
}
env.allowLocalModels = false;
env.useBrowserCache = true; // Solo archivos públicos del modelo, nunca voz ni texto.
// Transformers consulta metadatos sin pasar `revision`. Fijar también la ruta que usa esa consulta.
env.remotePathTemplate = `{model}/resolve/${REVISION_WHISPER}/`;

const carpetaModelo = new URL(`${MODELO_WHISPER}/resolve/${REVISION_WHISPER}/`, env.remoteHost);
const rutasMotor = new Set([wasm, mjs].map((ruta) => new URL(ruta, self.location.href).href));
const fetchOriginal = env.fetch;

function enviar(mensaje: WhisperMensaje) {
  self.postMessage(mensaje);
}

self.onmessage = async ({ data: audio }: MessageEvent<Float32Array>) => {
  let cargandoModelo = true;
  try {
    enviar({ tipo: 'cargando-modelo', archivos: [] });
    env.fetch = observarDescargasWhisper(fetchOriginal, (url) => {
      if (url.origin === carpetaModelo.origin && url.pathname.startsWith(carpetaModelo.pathname)) {
        return url.pathname.slice(carpetaModelo.pathname.length);
      }
      if (rutasMotor.has(url.href)) return url.pathname.split('/').pop();
    }, (archivos) => {
      if (cargandoModelo) enviar({ tipo: 'cargando-modelo', archivos });
    });
    const transcribir = await pipeline('automatic-speech-recognition', MODELO_WHISPER, {
      revision: REVISION_WHISPER,
      device: 'webgpu',
      dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
    });
    cargandoModelo = false;
    enviar({ tipo: 'transcribiendo' });
    const resultado = await transcribir(audio, {
      language: 'spanish',
      task: 'transcribe',
      // Whisper combina ventanas solapadas para no perder palabras en los cortes.
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    const fragmentos = Array.isArray(resultado) ? resultado : [resultado];
    enviar({ tipo: 'resultado', texto: fragmentos.map(({ text }) => text.trim()).join(' ').trim() });
  } catch {
    cargandoModelo = false;
    enviar({ tipo: 'error' });
  } finally {
    audio.fill(0);
  }
};
