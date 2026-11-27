import { useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  FlipGroup,
  FuseButton,
  LoadingButton,
  type FuseButtonProps,
} from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/fuse-button';
import '@yewdiel21/motion-kit/css/components/loading-button';
import {
  DESTINO_LABELS,
  isInternalDestino,
  validarTransicionDerivacion,
  type DerivacionItem,
  type EstadoDerivacion,
} from '@/features/canalizaciones/api';
import type { HistorialCanalizacionItem } from '@/domain/models/Derivacion';
import { DerivacionHistorial } from './DerivacionHistorial';
import { DerivacionStatusChip } from './DerivacionStatusChip';
import { formatDiaCalendario, formatMomento, nombreDestino } from './derivacionFormat';
import './canalizaciones.css';

interface DerivacionTimelineListProps {
  derivaciones: DerivacionItem[];
  /** Historial por canalización (RPC get_historial_canalizaciones); opcional, la lista funciona sin él. */
  historial?: readonly HistorialCanalizacionItem[];
  historialLoading?: boolean;
  updatingId: string | null;
  onUpdateEstado: (id: string, next: EstadoDerivacion) => Promise<void>;
}

const NEXT_STATUS: Partial<Record<EstadoDerivacion, { next: EstadoDerivacion; label: string }>> = {
  pendiente: { next: 'en_proceso', label: 'Pasar a en proceso' },
  en_proceso: { next: 'concluida', label: 'Marcar concluida' },
};

const CANCEL_FUSE_LABELS: NonNullable<FuseButtonProps['labels']> = {
  primary: 'Cancelar',
  secondary: 'Volver',
  confirm: 'Sí, cancelar',
  loading: 'Cancelando…',
  success: 'Cancelada',
  error: 'Error',
  prompt: '¿Cancelar esta canalización? Volver o Sí, cancelar.',
};

interface DerivacionCardProps {
  derivacion: DerivacionItem;
  index: number;
  historial: HistorialCanalizacionItem | undefined;
  historialLoading: boolean;
  isBusy: boolean;
  onUpdateEstado: (id: string, next: EstadoDerivacion) => Promise<void>;
}

function DerivacionCard({
  derivacion: d,
  index,
  historial,
  historialLoading,
  isBusy,
  onUpdateEstado,
}: DerivacionCardProps) {
  // Si el estado cambia durante la vida de la tarjeta, el chip se remonta y reproduce el «pop».
  const [estadoInicial] = useState(d.estado);
  const estadoCambio = estadoInicial !== d.estado;

  const advanceAction = NEXT_STATUS[d.estado];
  const canCancel = validarTransicionDerivacion(d.estado, 'cancelada') === null;
  const internal = isInternalDestino(d.destino);
  const titulo = nombreDestino(d, DESTINO_LABELS[d.destino]);
  const eventos = historial?.eventos ?? [];
  const ultimoCambio =
    historial && historial.actualizadoEn !== historial.creadoEn
      ? formatMomento(historial.actualizadoEn)
      : 'Sin cambios';

  return (
    <li
      data-flip-id={d.id}
      className="vc-canal-card"
      style={{ '--i': index } as CSSProperties}
    >
      <div className="vc-canal-card__head">
        <div className="min-w-0">
          <h4 className="vc-canal-card__title">{titulo}</h4>
          <p className="vc-canal-card__sub">
            {DESTINO_LABELS[d.destino]} · {internal ? 'Interna' : 'Externa'} · Desde{' '}
            {d.areaOrigenNombre ?? 'Dirección'}
          </p>
        </div>
        <DerivacionStatusChip key={d.estado} estado={d.estado} pop={estadoCambio} />
      </div>

      <dl className="vc-canal-dates">
        <div>
          <dt>Canalizada</dt>
          <dd>{formatDiaCalendario(d.fechaDerivacion)}</dd>
        </div>
        <div>
          <dt>Creada</dt>
          <dd>{formatMomento(d.creadoEn)}</dd>
        </div>
        <div>
          <dt>Último cambio</dt>
          <dd>{ultimoCambio}</dd>
        </div>
      </dl>

      {d.motivo ? (
        <div className="vc-canal-motivo">
          <p className="vc-canal-motivo__label">Motivo</p>
          <p className="vc-canal-motivo__text">{d.motivo}</p>
        </div>
      ) : null}

      <DerivacionHistorial
        eventos={eventos}
        creadoEn={d.creadoEn}
        loading={historialLoading && !historial}
      />

      {advanceAction || canCancel ? (
        <div className="vc-canal-card__actions">
          {canCancel ? (
            <FuseButton
              key={`${d.id}-${d.estado}`}
              mode="split"
              tone="danger"
              align="end"
              height={44}
              disabled={isBusy}
              labels={CANCEL_FUSE_LABELS}
              onConfirm={async () => {
                await onUpdateEstado(d.id, 'cancelada');
              }}
            />
          ) : null}

          {advanceAction ? (
            <LoadingButton
              type="button"
              aria-label={advanceAction.label}
              disabled={isBusy}
              state={isBusy ? 'loading' : 'idle'}
              compact={false}
              action={() => onUpdateEstado(d.id, advanceAction.next)}
              className="mk-button mk-button--filled min-h-11 px-5 text-base whitespace-nowrap"
            >
              {advanceAction.label}
            </LoadingButton>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function DerivacionTimelineList({
  derivaciones,
  historial,
  historialLoading = false,
  updatingId,
  onUpdateEstado,
}: DerivacionTimelineListProps) {
  const listRef = useRef<HTMLOListElement>(null);

  const flipSignature = useMemo(
    () => derivaciones.map((d) => `${d.id}:${d.estado}`).join('|'),
    [derivaciones],
  );
  const historialById = useMemo(
    () => new Map((historial ?? []).map((h) => [h.id, h])),
    [historial],
  );

  return (
    <FlipGroup root={listRef} signature={flipSignature}>
      <ol ref={listRef} aria-label="Lista de canalizaciones" className="vc-canal-list">
        {derivaciones.map((d, index) => (
          <DerivacionCard
            key={d.id}
            derivacion={d}
            index={index}
            historial={historialById.get(d.id)}
            historialLoading={historialLoading}
            isBusy={updatingId === d.id}
            onUpdateEstado={onUpdateEstado}
          />
        ))}
      </ol>
    </FlipGroup>
  );
}
