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

const ESTADO_BADGE_CLASS: Record<EstadoDerivacion, string> = {
  pendiente: 'bg-status-warning-bg text-status-warning',
  en_proceso: 'bg-status-info-bg text-status-info',
  concluida: 'bg-status-success-bg text-status-success',
  cancelada: 'bg-status-danger-bg text-status-danger',
};

interface TopBarProps {
  derivacion: DerivacionItem | null;
  onOpenExpediente: (fichaId: string) => void;
}

/** Cabecera del panel: cerrar, título y acceso directo al expediente. */
export const CanalizacionTopBar = memo(function CanalizacionTopBar({ derivacion, onOpenExpediente }: TopBarProps) {
  return (
    <Dialog.Header>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Dialog.Close label="Cerrar" />
          <Dialog.Title className="truncate text-2xl font-medium tracking-tight text-on-surface">
            Canalización
          </Dialog.Title>
        </div>
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
    </Dialog.Header>
  );
});

/** Tarjeta informativa discreta: tipo, estado, destino/institución, usuaria y folio. */
export const CanalizacionHeroCard = memo(function CanalizacionHeroCard({ derivacion }: { derivacion: DerivacionItem }) {
  return (
    <section
      aria-label="Resumen de la canalización"
      className="rounded-2xl border border-outline-variant bg-surface-container-low px-5 py-4 text-on-surface"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-on-surface-variant">
          {isInternalDestino(derivacion.destino) ? 'Canalización interna' : 'Canalización externa'}
        </p>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${ESTADO_BADGE_CLASS[derivacion.estado]}`}
        >
          <span aria-hidden className={`size-2.5 rounded-full ${getEstadoDotClass(derivacion.estado)}`} />
          {ESTADO_DERIVACION_LABELS[derivacion.estado]}
        </span>
      </div>

      <h3 className="mt-2 text-2xl font-semibold leading-snug text-on-surface">
        {DESTINO_LABELS[derivacion.destino]}
      </h3>
      <p className="mt-0.5 text-base text-on-surface-variant">{destinoNombre(derivacion)}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="text-base font-semibold text-on-surface">{derivacion.usuariaNombre}</p>
        <span className="rounded-full bg-primary-container px-3 py-0.5 font-mono text-sm font-semibold text-on-primary-container">
          {derivacion.folio}
        </span>
      </div>
    </section>
  );
});

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2.5 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
      <h4 className="text-sm font-semibold uppercase tracking-wide text-on-surface-variant">{title}</h4>
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
        <p className="whitespace-pre-wrap text-base leading-relaxed text-on-surface">
          {derivacion.motivo || 'Sin motivo registrado.'}
        </p>
      </SectionCard>

      <SectionCard title="Área de origen y destino">
        <div className="flex flex-wrap items-center gap-2 text-base font-medium text-on-surface">
          <span>{derivacion.areaOrigenNombre ?? 'Dirección / General'}</span>
          <Icon name="arrow_forward" className="text-[18px] text-on-surface-variant" />
          <span>{destinoNombre(derivacion)}</span>
        </div>
      </SectionCard>

      <SectionCard title="Fechas">
        <dl className="grid gap-3 text-base sm:grid-cols-2">
          <div>
            <dt className="text-sm text-on-surface-variant">Fecha de canalización</dt>
            <dd className="mt-0.5 font-medium text-on-surface">{formatFecha(derivacion.fechaDerivacion)}</dd>
          </div>
          <div>
            <dt className="text-sm text-on-surface-variant">Registrada el</dt>
            <dd className="mt-0.5 font-medium text-on-surface">{formatFechaHora(derivacion.creadoEn)}</dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard title="Progreso del seguimiento">
        {derivacion.estado === 'cancelada' ? (
          <div className="flex items-center gap-2.5 rounded-xl bg-status-danger-bg px-4 py-3 text-sm font-medium text-status-danger sm:text-base">
            <Icon name="cancel" className="shrink-0 text-[20px]" />
            <span>Canalización cancelada (estado final).</span>
          </div>
        ) : (
          <ol className="grid grid-cols-3 pt-1">
            {PROGRESS.map((step, index) => {
              const isReached = index <= reached;
              const isCurrent = index === reached;
              const leftFilled = index > 0 && index <= reached;
              const rightFilled = index < PROGRESS.length - 1 && index < reached;

              return (
                <li
                  key={step.estado}
                  aria-current={isCurrent ? 'step' : undefined}
                  className="relative flex flex-col items-center text-center"
                >
                  {index > 0 ? (
                    <span
                      aria-hidden
                      className={`absolute top-4 right-1/2 left-0 h-0.5 -translate-y-1/2 ${
                        leftFilled ? 'bg-primary' : 'bg-outline-variant'
                      }`}
                    />
                  ) : null}
                  {index < PROGRESS.length - 1 ? (
                    <span
                      aria-hidden
                      className={`absolute top-4 right-0 left-1/2 h-0.5 -translate-y-1/2 ${
                        rightFilled ? 'bg-primary' : 'bg-outline-variant'
                      }`}
                    />
                  ) : null}

                  <span
                    className={`relative z-10 inline-flex size-8 items-center justify-center rounded-full text-sm font-semibold ${
                      isReached
                        ? 'bg-primary text-on-primary'
                        : 'border border-outline-variant bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {isReached ? <Icon name="check" className="text-[18px]" /> : index + 1}
                  </span>

                  <span
                    className={`mt-2 text-sm font-medium sm:text-base ${
                      isReached ? 'text-on-surface' : 'text-on-surface-variant'
                    }`}
                  >
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </SectionCard>
    </>
  );
});
