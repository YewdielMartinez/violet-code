import { useCallback, useEffect, useRef, useState } from 'react';
import { transcribirLocal } from '@/infrastructure/whisper/transcribirLocal';
import type { WhisperEstado } from '@/infrastructure/whisper/protocol';

export const MAX_SEGUNDOS_DICTADO = 5 * 60;

export type EstadoDictado =
  | { tipo: 'inactivo' | 'permiso' | 'preparando-audio' }
  /** `stream` solo alimenta los indicadores visuales locales; nunca sale del dispositivo. */
  | { tipo: 'grabando'; stream: MediaStream; desde: number }
  | WhisperEstado
  | { tipo: 'revision'; texto: string }
  | { tipo: 'error'; mensaje: string };

interface Grabacion {
  abort: AbortController;
  stream?: MediaStream;
  recorder?: MediaRecorder;
  timer?: ReturnType<typeof setTimeout>;
}

function liberarMicrofono(sesion: Grabacion) {
  clearTimeout(sesion.timer);
  sesion.stream?.getTracks().forEach((track) => track.stop());
  sesion.stream = undefined;
}

function cancelarGrabacion(sesion: Grabacion) {
  sesion.abort.abort();
  if (sesion.recorder) {
    sesion.recorder.ondataavailable = null;
    sesion.recorder.onstop = null;
    sesion.recorder.onerror = null;
    if (sesion.recorder.state !== 'inactive') sesion.recorder.stop();
  }
  liberarMicrofono(sesion);
}

const ERROR_LOCAL = 'No se pudo procesar el dictado local. Comprueba la conexión para descargar el modelo y que WebGPU esté disponible, o escribe la nota.';

export function useSpeechDictation() {
  const [estado, setEstado] = useState<EstadoDictado>({ tipo: 'inactivo' });
  const actual = useRef<Grabacion | null>(null);
  const disponible = globalThis.isSecureContext && typeof Worker !== 'undefined'
    && typeof MediaRecorder !== 'undefined' && typeof OfflineAudioContext !== 'undefined'
    && 'gpu' in navigator && Boolean(navigator.mediaDevices?.getUserMedia);
  const activo = estado.tipo !== 'inactivo' && estado.tipo !== 'error';

  const cancelar = useCallback(() => {
    const sesion = actual.current;
    actual.current = null;
    if (sesion) cancelarGrabacion(sesion);
  }, []);

  useEffect(() => cancelar, [cancelar]);

  function descartar() {
    cancelar();
    setEstado({ tipo: 'inactivo' });
  }

  function detener() {
    const recorder = actual.current?.recorder;
    if (recorder?.state === 'recording') {
      recorder.stop();
      if (actual.current) liberarMicrofono(actual.current);
      setEstado({ tipo: 'preparando-audio' });
    }
  }

  async function iniciar() {
    if (!disponible || actual.current || activo) return;

    const sesion: Grabacion = { abort: new AbortController() };
    actual.current = sesion;
    setEstado({ tipo: 'permiso' });

    function fallar(mensaje: string) {
      if (actual.current !== sesion) return;
      cancelar();
      setEstado({ tipo: 'error', mensaje });
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (sesion.abort.signal.aborted) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      sesion.stream = stream;
      const recorder = new MediaRecorder(stream);
      sesion.recorder = recorder;
      const partes: Blob[] = [];
      recorder.ondataavailable = ({ data }) => {
        if (data.size > 0) partes.push(data);
      };
      recorder.onerror = () => fallar('El micrófono dejó de grabar. Inténtalo de nuevo o escribe la nota.');
      recorder.onstop = async () => {
        liberarMicrofono(sesion);
        sesion.recorder = undefined;
        if (actual.current !== sesion) return;
        const audio = new Blob(partes, { type: recorder.mimeType });
        partes.length = 0;
        if (!audio.size) {
          fallar('No se grabó audio. Inténtalo de nuevo o escribe la nota.');
          return;
        }
        setEstado({ tipo: 'preparando-audio' });
        try {
          const texto = await transcribirLocal(audio, sesion.abort.signal, (mensaje) => {
            if (actual.current === sesion) setEstado(mensaje);
          });
          if (actual.current !== sesion) return;
          if (!texto) {
            fallar('No se reconoció voz. Inténtalo de nuevo o escribe la nota.');
            return;
          }
          actual.current = null;
          setEstado({ tipo: 'revision', texto });
        } catch {
          fallar(ERROR_LOCAL);
        }
      };
      recorder.start();
      sesion.timer = setTimeout(detener, MAX_SEGUNDOS_DICTADO * 1_000);
      setEstado({ tipo: 'grabando', stream, desde: Date.now() });
    } catch (error) {
      const denegado = error instanceof DOMException && error.name === 'NotAllowedError';
      fallar(denegado
        ? 'No se concedió acceso al micrófono. Puedes escribir la nota.'
        : 'No se pudo abrir el micrófono. Verifica que esté disponible o escribe la nota.');
    }
  }

  return { estado, disponible, activo, iniciar, detener, descartar };
}
