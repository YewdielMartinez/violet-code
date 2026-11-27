import type { WhisperEstado, WhisperMensaje } from './protocol';

const MUESTRAS_POR_SEGUNDO = 16_000;

async function prepararAudio(blob: Blob): Promise<Float32Array<ArrayBuffer>> {
  // OfflineAudioContext remuestrea a 16 kHz al decodificar sin abrir una salida de audio.
  const decoder = new OfflineAudioContext(1, 1, MUESTRAS_POR_SEGUNDO);
  const buffer = await decoder.decodeAudioData(await blob.arrayBuffer());
  const mono = new Float32Array(buffer.length);
  for (let canal = 0; canal < buffer.numberOfChannels; canal++) {
    const muestras = buffer.getChannelData(canal);
    for (let i = 0; i < mono.length; i++) mono[i] += muestras[i] / buffer.numberOfChannels;
  }
  return mono;
}

export async function transcribirLocal(
  blob: Blob,
  signal: AbortSignal,
  informar: (mensaje: WhisperEstado) => void,
): Promise<string> {
  const audio = await prepararAudio(blob);
  if (signal.aborted) {
    audio.fill(0);
    signal.throwIfAborted();
  }

  const worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    function cerrar() {
      signal.removeEventListener('abort', cancelar);
      worker.terminate();
    }
    function cancelar() {
      cerrar();
      reject(signal.reason);
    }
    function fallar() {
      cerrar();
      reject(new Error('No se pudo transcribir en este dispositivo.'));
    }
    worker.onmessage = ({ data }: MessageEvent<WhisperMensaje>) => {
      switch (data.tipo) {
        case 'resultado':
          cerrar();
          resolve(data.texto);
          break;
        case 'error':
          fallar();
          break;
        default:
          informar(data);
      }
    };
    worker.onerror = fallar;
    worker.onmessageerror = fallar;
    signal.addEventListener('abort', cancelar, { once: true });
    try {
      worker.postMessage(audio, [audio.buffer]);
    } catch {
      audio.fill(0);
      fallar();
    }
  });
}
