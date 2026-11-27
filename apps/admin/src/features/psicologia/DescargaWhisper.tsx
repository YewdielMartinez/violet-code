import { Progress } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/progress';
import type { ArchivoWhisper } from '@/infrastructure/whisper/protocol';

const FORMATO_BYTES = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });

function formatearBytes(bytes: number) {
  if (bytes >= 1_000_000) return `${FORMATO_BYTES.format(bytes / 1_000_000)} MB`;
  if (bytes >= 1_000) return `${FORMATO_BYTES.format(bytes / 1_000)} kB`;
  return `${bytes} B`;
}

function detalleArchivo(archivo: ArchivoWhisper) {
  if (archivo.fase === 'listo') return `Descargado · ${formatearBytes(archivo.recibidos)}`;
  if (archivo.fase === 'conectando') return 'Conectando…';
  if (archivo.total === null) return `${formatearBytes(archivo.recibidos)} recibidos`;
  return `${formatearBytes(archivo.recibidos)} de ${formatearBytes(archivo.total)}`;
}

export function DescargaWhisper({ archivos }: { archivos: ArchivoWhisper[] }) {
  const pendientes = archivos.filter((archivo) => archivo.fase !== 'listo');
  const descargando = pendientes.some((archivo) => archivo.fase === 'descargando');
  const visibles = [...pendientes, ...archivos.filter((archivo) => archivo.fase === 'listo')];

  return (
    <div className="grid gap-2">
      <p role="status" className="font-medium">
        {descargando ? 'Descargando archivos de Whisper…'
          : pendientes.length ? 'Conectando para descargar Whisper…'
            : 'Preparando Whisper en este dispositivo…'}
      </p>
      {visibles.length > 0 && (
        <ul aria-label="Archivos de Whisper" className="grid max-h-60 gap-2 overflow-y-auto">
          {visibles.map((archivo) => (
            <li key={archivo.nombre} className="grid gap-1 rounded-lg bg-surface-container-low p-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-medium wrap-anywhere">{archivo.nombre}</span>
                <span className="text-xs tabular-nums text-on-surface-variant">{detalleArchivo(archivo)}</span>
              </div>
              {archivo.fase === 'descargando' && (
                <Progress label={`Descarga de ${archivo.nombre}`}
                  value={archivo.total === null ? null : (archivo.recibidos / archivo.total) * 100}
                  showValue={archivo.total !== null} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
