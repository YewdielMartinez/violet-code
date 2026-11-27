import { useEffect, useId, useState, type ReactNode } from 'react';
import { Progress, VoiceAura, VoiceDots } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/progress';
import '@yewdiel21/motion-kit/css/components/voice-aura';
import '@yewdiel21/motion-kit/css/components/voice-dots';
import { Icon } from '@/shared/ui/Icon';
import { IconoEnLinea } from './IconoEnLinea';
import { DescargaWhisper } from './DescargaWhisper';
import { MAX_SEGUNDOS_DICTADO, type useSpeechDictation } from './useSpeechDictation';

interface Props {
  dictado: ReturnType<typeof useSpeechDictation>;
  disabled: boolean;
  onInsertar: (texto: string) => void;
  /** Control opcional en la cabecera (p. ej. el campo destino del dictado). */
  destino?: ReactNode;
  /** Nombre del campo donde se insertará la transcripción. */
  destinoLabel?: string;
}

function formatoMinutos(segundos: number) {
  const s = Math.max(0, Math.floor(segundos));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function Cronometro({ desde }: { desde: number }) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);
  const transcurrido = Math.min(MAX_SEGUNDOS_DICTADO, (ahora - desde) / 1_000);
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-xs text-on-surface-variant">
        <span>Tiempo de grabación</span>
        <span className="font-mono tabular-nums">
          {formatoMinutos(transcurrido)} / {formatoMinutos(MAX_SEGUNDOS_DICTADO)}
        </span>
      </div>
      <Progress label="Tiempo de grabación" value={(transcurrido / MAX_SEGUNDOS_DICTADO) * 100} />
    </div>
  );
}

function Procesando({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex items-center gap-3">
      <VoiceDots state="thinking" size={10} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function DictadoVozControl({ dictado, disabled, onInsertar, destino, destinoLabel }: Props) {
  const { estado, disponible, activo, iniciar, detener, descartar } = dictado;
  const aviso = useId();
  const grabando = estado.tipo === 'grabando';

  return (
    <section
      aria-label="Dictado por voz"
      className={`relative isolate overflow-hidden rounded-2xl border bg-surface p-4 text-sm transition-colors ${
        grabando ? 'border-primary/50' : 'border-outline-variant'
      }`}
    >
      {grabando && (
        <VoiceAura state="listening" source={estado.stream} height="80%" intensity={0.55}
          aria-hidden="true" className="pointer-events-none" />
      )}

      <div className="relative z-10 grid gap-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`grid size-10 shrink-0 place-items-center rounded-full ${
              grabando ? 'bg-primary text-on-primary' : 'bg-primary-container text-on-primary-container'
            }`}>
              <Icon name={grabando ? 'graphic_eq' : 'mic'} />
            </span>
            <div>
              <p className="font-semibold text-on-surface">Dictado por voz</p>
              <p className="inline-flex items-center gap-1 text-xs text-on-surface-variant">
                <Icon name="lock" className="text-sm" /> Procesado en este dispositivo con Whisper
              </p>
            </div>
          </div>
          {destino}
        </header>

        <p id={aviso}
          className="flex items-start gap-2 rounded-xl border border-status-warning/40 bg-status-warning-bg/40 px-3 py-2.5 text-on-surface">
          <IconoEnLinea name="privacy_tip" className="text-status-warning" />
          <span>
            <strong className="font-semibold">No dictes CURP ni nombres propios.</strong>{' '}
            <span className="text-on-surface-variant">El audio no se guarda ni se envía a terceros.</span>
          </span>
        </p>

        <div aria-live="polite" className="grid gap-3 empty:hidden">
          {!disponible && (
            <p className="flex items-start gap-2 text-on-surface-variant">
              <IconoEnLinea name="info" />
              <span>El dictado requiere un navegador con WebGPU y micrófono sobre HTTPS o localhost. Puedes escribir la nota.</span>
            </p>
          )}
          {estado.tipo === 'inactivo' && disponible && (
            <p className="text-on-surface-variant">
              Hasta {MAX_SEGUNDOS_DICTADO / 60} minutos por grabación. La primera vez se descargan los archivos del modelo.
            </p>
          )}
          {estado.tipo === 'permiso' && <Procesando>Esperando permiso del micrófono…</Procesando>}
          {grabando && (
            <>
              <div role="status" className="flex items-center gap-3">
                <VoiceDots state="listening" source={estado.stream} size={12} aria-hidden="true" />
                <span className="font-medium text-on-surface">
                  Escuchando{destinoLabel ? ` · ${destinoLabel}` : ''}
                </span>
              </div>
              <Cronometro desde={estado.desde} />
            </>
          )}
          {estado.tipo === 'preparando-audio' && <Procesando>Preparando el audio…</Procesando>}
          {estado.tipo === 'cargando-modelo' && <DescargaWhisper archivos={estado.archivos} />}
          {estado.tipo === 'transcribiendo' && <Procesando>Transcribiendo en este dispositivo…</Procesando>}
          {estado.tipo === 'error' && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-error-container px-3 py-2.5 text-on-error-container">
              <IconoEnLinea name="error" /> <span>{estado.mensaje}</span>
            </p>
          )}
          {estado.tipo === 'revision' && (
            <div className="grid gap-2">
              <p className="font-medium text-on-surface">
                Revisa la transcripción antes de añadirla{destinoLabel ? ` a «${destinoLabel}»` : ''}
              </p>
              <blockquote className="max-h-48 overflow-auto whitespace-pre-wrap wrap-anywhere rounded-xl border-l-4 border-primary bg-surface-container-low px-4 py-3 text-on-surface">
                {estado.texto}
              </blockquote>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {!activo && (
            <button type="button" className="mk-button mk-button--tonal" disabled={disabled || !disponible}
              aria-describedby={aviso} onClick={() => void iniciar()}>
              <Icon name="mic" /> {estado.tipo === 'error' ? 'Intentar de nuevo' : 'Iniciar dictado'}
            </button>
          )}
          {grabando && (
            <button type="button" className="mk-button mk-button--primary" onClick={detener}>
              <Icon name="stop_circle" /> Detener y transcribir
            </button>
          )}
          {estado.tipo === 'revision' && (
            <button type="button" className="mk-button mk-button--primary" disabled={disabled} onClick={() => {
              onInsertar(estado.texto);
              descartar();
            }}>
              <Icon name="playlist_add" /> Añadir al campo
            </button>
          )}
          {activo && (
            <button type="button" className="mk-button mk-button--text" onClick={descartar}>
              {estado.tipo === 'revision' ? 'Descartar transcripción' : 'Cancelar dictado'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
