import { useMemo, useRef } from 'react';
import {
  FlipGroup,
  FuseButton,
  LoadingButton,
  type FuseButtonProps,
} from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/fuse-button';
import '@yewdiel21/motion-kit/css/components/loading-button';
import { Icon } from '@/shared/ui/Icon';
import {
  DESTINO_LABELS,
  isInternalDestino,
  validarTransicionDerivacion,
  type DerivacionItem,
  type EstadoDerivacion,
} from '@/features/canalizaciones/api';
import { DerivacionStatusChip, getEstadoDotClass } from './DerivacionStatusChip';

interface DerivacionTimelineListProps {
  derivaciones: DerivacionItem[];
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

export function DerivacionTimelineList({
  derivaciones,
  updatingId,
  onUpdateEstado,
}: DerivacionTimelineListProps) {
  const listRef = useRef<HTMLOListElement>(null);

  const flipSignature = useMemo(
    () => derivaciones.map((d) => `${d.id}:${d.estado}`).join('|'),
    [derivaciones],
  );

  return (
    <FlipGroup root={listRef} signature={flipSignature}>
      <ol
        ref={listRef}
        aria-label="Línea de tiempo de canalizaciones"
        className="relative grid gap-3 pl-5 before:absolute before:top-4 before:bottom-4 before:left-2 before:w-px before:bg-outline-variant"
      >
        {derivaciones.map((d) => {
          const advanceAction = NEXT_STATUS[d.estado];
          const canCancel = validarTransicionDerivacion(d.estado, 'cancelada') === null;
          const isBusy = updatingId === d.id;
          const internal = isInternalDestino(d.destino);
          const targetName =
            d.areaDestinoNombre ?? d.institucionNombre ?? d.institucionOtra ?? '—';

          return (
            <li
              key={d.id}
              data-flip-id={d.id}
              className="relative grid gap-2.5 rounded-2xl border border-outline-variant bg-surface-container-low p-3.5"
            >
              <span
                aria-hidden="true"
                className={`absolute top-5 -left-[1.0625rem] h-2.5 w-2.5 rounded-full ring-4 ring-surface ${getEstadoDotClass(d.estado)}`}
              />

              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-on-surface">
                    <span>{d.areaOrigenNombre ?? 'Dirección'}</span>
                    <Icon name="arrow_forward" className="text-[16px] text-on-surface-variant" />
                    <span>{DESTINO_LABELS[d.destino]}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    {internal ? 'Interna' : 'Externa'} · {targetName} · {d.fechaDerivacion}
                  </p>
                </div>

                <DerivacionStatusChip estado={d.estado} />
              </div>

              {d.motivo ? (
                <p className="rounded-xl bg-surface-container-lowest px-3 py-2 text-sm text-on-surface">
                  {d.motivo}
                </p>
              ) : null}

              {advanceAction || canCancel ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/60 pt-2.5">
                  {advanceAction ? (
                    <LoadingButton
                      type="button"
                      aria-label={advanceAction.label}
                      disabled={isBusy}
                      state={isBusy ? 'loading' : 'idle'}
                      compact={false}
                      action={() => onUpdateEstado(d.id, advanceAction.next)}
                      className="mk-button mk-button--tonal mk-button--sm"
                    >
                      <Icon name="arrow_right_alt" />
                      <span>{advanceAction.label}</span>
                    </LoadingButton>
                  ) : (
                    <span />
                  )}

                  {canCancel ? (
                    <FuseButton
                      key={`${d.id}-${d.estado}`}
                      mode="split"
                      tone="danger"
                      align="end"
                      height={34}
                      disabled={isBusy}
                      labels={CANCEL_FUSE_LABELS}
                      onConfirm={async () => {
                        await onUpdateEstado(d.id, 'cancelada');
                      }}
                    />
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </FlipGroup>
  );
}
