import { memo, useId, useState, type FormEvent } from 'react';
import { EmptyState, LoadingButton, Skeleton, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/loading-button';
import '@yewdiel21/motion-kit/css/components/skeleton';
import {
  NOTA_PRIVADA_MAX_LENGTH,
  ordenarNotasRecientes,
  puedeGestionarNotasPrivadas,
  puedeVerNotasPrivadas,
  validateNotaPrivada,
} from '@/domain/models/NotaPrivada';
import { useAuth } from '@/shared/auth/useAuth';
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
 * Cada área de atención lee y edita solo las suyas; Titular y Subdirección ven las de todas las áreas en solo lectura; Recepción y UMECA no tienen acceso.
 */
export const NotasPrivadasPanel = memo(function NotasPrivadasPanel({ fichaId }: NotasPrivadasPanelProps) {
  const { user } = useAuth();
  const textareaId = useId();
  const puedeVer = puedeVerNotasPrivadas(user?.role);
  const puedeEditar = puedeGestionarNotasPrivadas(user?.role) && user?.areaId != null;
  const soloLectura = puedeVer && !puedeEditar;

  const [contenido, setContenido] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');

  const notasQuery = useNotasPrivadas(fichaId, puedeVer);
  const crear = useCrearNotaPrivada(fichaId);

  if (!puedeVer) {
    return (
      <EmptyState
        illustration="error"
        title="Sin acceso a notas privadas"
        description="Las notas de cada área solo están disponibles para Trabajo Social, Psicología, Jurídico y Dirección."
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
        {soloLectura ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-tertiary-container px-3 py-1 text-xs font-medium text-on-tertiary-container">
              <Icon name="visibility" className="text-sm" />
              Todas las áreas · solo lectura
            </span>
            <span className="text-xs text-on-surface-variant">Dirección</span>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-tertiary-container px-3 py-1 text-xs font-medium text-on-tertiary-container">
              <Icon name="lock" className="text-sm" />
              Solo visible para tu área
            </span>
            <span className="text-xs text-on-surface-variant">{user?.areaNombre}</span>
          </>
        )}
      </div>

      {puedeEditar ? (
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
      ) : null}

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
              title={soloLectura ? 'Sin notas registradas' : 'Sin notas del área'}
              description={
                soloLectura
                  ? 'Aún no hay notas de las áreas sobre este expediente.'
                  : 'Las notas que registre tu área sobre este expediente aparecerán aquí.'
              }
            />
          ) : (
            <ul className="grid gap-3">
              {notas.map((nota) => (
                <NotaPrivadaItem key={nota.id} nota={nota} fichaId={fichaId} readOnly={soloLectura} />
              ))}
            </ul>
          )}
        </Skeleton>
      )}
    </div>
  );
});
