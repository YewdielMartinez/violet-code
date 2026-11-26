import { memo, useId, useState, type FormEvent } from 'react';
import { EmptyState, LoadingButton, Skeleton, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/loading-button';
import '@yewdiel21/motion-kit/css/components/skeleton';
import {
  NOTA_PRIVADA_MAX_LENGTH,
  ordenarNotasRecientes,
  puedeGestionarNotasPrivadas,
  validateNotaPrivada,
} from '@/domain/models/NotaPrivada';
import { isSupervisor, useAuth } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';
import { NotaPrivadaItem } from './NotaPrivadaItem';
import { traducirErrorIntervencion, useCrearNotaPrivada, useNotasPrivadas } from './api';

export interface NotasPrivadasPanelProps {
  fichaId: string;
}

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

const LOADING_LABELS = { loading: 'Guardando…', success: 'Nota guardada', error: 'No se guardó' };
const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];

/**
 * Notas privadas del área sobre el expediente (`RF-10`, `RN-09`, `RN-18.1`).
 * Solo la propia área las lee y edita; Dirección, Recepción y UMECA no tienen acceso.
 */
export const NotasPrivadasPanel = memo(function NotasPrivadasPanel({ fichaId }: NotasPrivadasPanelProps) {
  const { user } = useAuth();
  const textareaId = useId();
  const permitido = puedeGestionarNotasPrivadas(user?.role) && user?.areaId != null;

  const [contenido, setContenido] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');

  const notasQuery = useNotasPrivadas(fichaId, permitido);
  const crear = useCrearNotaPrivada(fichaId);

  if (!permitido) {
    return (
      <EmptyState
        illustration="error"
        title="Notas privadas por área"
        description={
          isSupervisor(user?.role)
            ? 'Por confidencialidad (RN-18.1), las notas de cada área solo las ve esa área; Dirección no tiene acceso a ellas.'
            : 'Las notas privadas solo están disponibles para Trabajo Social, Psicología y Jurídico, y cada área ve únicamente las suyas.'
        }
      />
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateNotaPrivada(contenido);
    if (error) {
      toast(error, { tone: 'error' });
      return;
    }
    setSubmitState('loading');
    try {
      await crear.mutateAsync({ fichaId, areaId: user?.areaId as number, contenido });
      setContenido('');
      setSubmitState('success');
      toast('Nota privada guardada.', { tone: 'success' });
    } catch (err) {
      setSubmitState('error');
      toast(traducirErrorIntervencion(err, 'No se pudo guardar la nota.'), { tone: 'error' });
    }
  }

  const notas = ordenarNotasRecientes(notasQuery.data ?? []);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tertiary-container px-3 py-1 text-xs font-medium text-on-tertiary-container">
          <Icon name="lock" className="text-sm" />
          Solo visible para tu área
        </span>
        <span className="text-xs text-on-surface-variant">{user?.areaNombre}</span>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-2">
        <label htmlFor={textareaId} className="text-sm font-medium text-on-surface">
          Nueva nota
        </label>
        <textarea
          id={textareaId}
          rows={3}
          maxLength={NOTA_PRIVADA_MAX_LENGTH}
          value={contenido}
          disabled={submitState === 'loading'}
          onChange={(e) => setContenido(e.target.value)}
          placeholder="Observaciones internas del área (no aparecen en la línea de tiempo)"
          className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-on-surface-variant">
            {contenido.trim().length}/{NOTA_PRIVADA_MAX_LENGTH}
          </span>
          <LoadingButton
            type="submit"
            state={submitState}
            labels={LOADING_LABELS}
            disabled={submitState === 'loading' || !contenido.trim()}
            className="mk-button mk-button--tonal mk-button--sm"
          >
            Guardar nota
          </LoadingButton>
        </div>
      </form>

      {notasQuery.isError ? (
        <EmptyState
          illustration="error"
          title="No se pudieron cargar las notas"
          actions={RETRY_ACTION}
          onAction={() => void notasQuery.refetch()}
        />
      ) : (
        <Skeleton loading={notasQuery.isLoading} shape="card" lines={3} label="Cargando notas">
          {notas.length === 0 ? (
            <EmptyState
              illustration="inbox"
              title="Sin notas del área"
              description="Las notas que registre tu área sobre este expediente aparecerán aquí."
            />
          ) : (
            <ul className="grid gap-3">
              {notas.map((nota) => (
                <NotaPrivadaItem key={nota.id} nota={nota} fichaId={fichaId} />
              ))}
            </ul>
          )}
        </Skeleton>
      )}
    </div>
  );
});
