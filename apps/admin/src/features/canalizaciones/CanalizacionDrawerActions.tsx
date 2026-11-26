import { memo } from 'react';
import { FuseButton, LoadingButton, type FuseButtonProps } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/fuse-button';
import '@yewdiel21/motion-kit/css/components/loading-button';
import { Icon } from '@/shared/ui/Icon';
import { validarTransicionDerivacion, type DerivacionItem, type EstadoDerivacion } from './api';

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

interface Props {
  derivacion: DerivacionItem;
  updatingId: string | null;
  onUpdateEstado: (id: string, next: EstadoDerivacion) => Promise<void>;
}

/** Cambio de estado: avanzar (pendiente → en proceso → concluida) o cancelar con confirmación. */
export const CanalizacionDrawerActions = memo(function CanalizacionDrawerActions({
  derivacion,
  updatingId,
  onUpdateEstado,
}: Props) {
  const advance = NEXT_STATUS[derivacion.estado];
  const canCancel = validarTransicionDerivacion(derivacion.estado, 'cancelada') === null;
  const busy = updatingId === derivacion.id;
  if (!advance && !canCancel) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-container-low p-4">
      {advance ? (
        <LoadingButton
          type="button"
          aria-label={advance.label}
          disabled={busy}
          state={busy ? 'loading' : 'idle'}
          compact={false}
          action={() => onUpdateEstado(derivacion.id, advance.next)}
          className="mk-button mk-button--primary"
        >
          <Icon name="arrow_right_alt" />
          <span>{advance.label}</span>
        </LoadingButton>
      ) : (
        <span />
      )}
      {canCancel ? (
        <FuseButton
          key={`${derivacion.id}-${derivacion.estado}`}
          mode="split"
          tone="danger"
          align="end"
          height={40}
          disabled={busy}
          labels={CANCEL_FUSE_LABELS}
          onConfirm={async () => {
            await onUpdateEstado(derivacion.id, 'cancelada');
          }}
        />
      ) : null}
    </div>
  );
});
