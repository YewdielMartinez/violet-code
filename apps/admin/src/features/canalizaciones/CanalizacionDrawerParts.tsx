import { memo, type ReactNode } from 'react';
import { Dialog } from '@yewdiel21/motion-kit/react';
import { getEstadoDotClass } from '@/features/expedientes/canalizaciones/DerivacionStatusChip';
import { Icon } from '@/shared/ui/Icon';
import {
  DESTINO_LABELS,
  ESTADO_DERIVACION_LABELS,
  isInternalDestino,
  type DerivacionItem,
  type EstadoDerivacion,
} from './api';

const FECHA_FMT = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' });
const FECHA_HORA_FMT = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

function formatFecha(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? FECHA_FMT.format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : iso;
}

function formatFechaHora(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : FECHA_HORA_FMT.format(d);
}

export function destinoNombre(d: DerivacionItem): string {
  return d.areaDestinoNombre ?? d.institucionNombre ?? d.institucionOtra ?? DESTINO_LABELS[d.destino];
}

interface TopBarProps {
  derivacion: DerivacionItem | null;
  onOpenExpediente: (fichaId: string) => void;
}

/** Cabecera del panel: cerrar y acceso directo al expediente. */
export const CanalizacionTopBar = memo(function CanalizacionTopBar({ derivacion, onOpenExpediente }: TopBarProps) {
  return (
    <Dialog.Header>
      <div className="flex items-center justify-between gap-3">
        <Dialog.Close label="Cerrar" />
        {derivacion ? (
          <button
            type="button"
            className="mk-button mk-button--tonal"
            onClick={() => onOpenExpediente(derivacion.fichaId)}
          >
            <Icon name="folder_open" />
            <span>Abrir expediente</span>
          </button>
        ) : null}
      </div>
      <Dialog.Title className="text-2xl font-normal tracking-tight text-on-surface">Canalización</Dialog.Title>
    </Dialog.Header>
  );
});

/** Tarjeta protagonista: destino/institución, usuaria, folio y estado. */
export const CanalizacionHeroCard = memo(function CanalizacionHeroCard({ derivacion }: { derivacion: DerivacionItem }) {
  return (
    <section aria-label="Resumen de la canalización" className="rounded-3xl bg-primary p-6 text-on-primary sm:p-7">
      <p className="text-sm font-medium text-on-primary/90">
        {isInternalDestino(derivacion.destino) ? 'Canalización interna' : 'Canalización externa'}
      </p>
      <h3 className="mt-1 text-3xl font-medium leading-tight tracking-tight text-on-primary">
        {DESTINO_LABELS[derivacion.destino]}
      </h3>
      <p className="text-sm text-on-primary/90">{destinoNombre(derivacion)}</p>

      <div className="mt-5 grid gap-1">
        <p className="text-xl font-medium text-on-primary">{derivacion.usuariaNombre}</p>
        <p className="font-mono text-sm tracking-wide text-on-primary">{derivacion.folio}</p>
      </div>

      <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-on-primary/15 px-3 py-1 text-sm font-medium text-on-primary">
        <span aria-hidden className={`size-2.5 rounded-full ${getEstadoDotClass(derivacion.estado)}`} />
        {ESTADO_DERIVACION_LABELS[derivacion.estado]}
      </span>
    </section>
  );
});

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
      <h4 className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">{title}</h4>
      {children}
    </section>
  );
}

const PROGRESS: ReadonlyArray<{ estado: EstadoDerivacion; label: string }> = [
  { estado: 'pendiente', label: 'Pendiente' },
  { estado: 'en_proceso', label: 'En proceso' },
  { estado: 'concluida', label: 'Concluida' },
];

/** Motivo completo, áreas, fechas y progreso del seguimiento. */
export const CanalizacionSections = memo(function CanalizacionSections({ derivacion }: { derivacion: DerivacionItem }) {
  const reached = PROGRESS.findIndex((p) => p.estado === derivacion.estado);
  return (
    <>
      <SectionCard title="Motivo y observaciones">
        <p className="whitespace-pre-wrap text-sm text-on-surface">{derivacion.motivo || 'Sin motivo registrado.'}</p>
      </SectionCard>

      <SectionCard title="Área de origen y destino">
        <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-on-surface">
          <span>{derivacion.areaOrigenNombre ?? 'Dirección / General'}</span>
          <Icon name="arrow_forward" className="text-[16px] text-on-surface-variant" />
          <span>{destinoNombre(derivacion)}</span>
        </div>
      </SectionCard>

      <SectionCard title="Fechas">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-on-surface-variant">Fecha de canalización</dt>
            <dd className="font-medium text-on-surface">{formatFecha(derivacion.fechaDerivacion)}</dd>
          </div>
          <div>
            <dt className="text-xs text-on-surface-variant">Registrada el</dt>
            <dd className="font-medium text-on-surface">{formatFechaHora(derivacion.creadoEn)}</dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard title="Progreso del seguimiento">
        {derivacion.estado === 'cancelada' ? (
          <p className="rounded-xl bg-status-danger-bg px-3 py-2 text-xs font-medium text-status-danger">
            Canalización cancelada (estado final).
          </p>
        ) : (
          <ol className="grid grid-cols-3 gap-1.5 text-center text-xs">
            {PROGRESS.map((step, index) => (
              <li
                key={step.estado}
                className={`rounded-xl px-2 py-1.5 font-medium ${
                  index <= reached
                    ? 'bg-primary-container text-on-primary-container'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {step.label}
              </li>
            ))}
          </ol>
        )}
      </SectionCard>
    </>
  );
});
