import { useMemo, useRef, useState } from 'react';
import { EmptyState, Skeleton } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/skeleton';
import { Icon } from '@/shared/ui/Icon';
import {
  DROGA_LABELS,
  formatAgresorNombre,
  useAgresores,
  useAsentamientosAhome,
  useOcupaciones,
  useParentescos,
  useRegistrarConsultaAgresor,
  useRegistrarConsultaTabAgresor,
  type Agresor,
} from './agresorApi';
import { AgresorForm } from './AgresorForm';

const EMPTY_ADD_ACTION = [{ id: 'add', label: 'Agregar persona agresora' }];
const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];

type FormMode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; agresor: Agresor };

interface Props {
  fichaId: string;
}

/**
 * Sección de Persona Agresora dentro del panel lateral del expediente (`RF-05`, `RF-22`).
 * Registra consulta en bitácora al montar la pestaña y al abrir un registro individual para edición.
 */
export function AgresorFormSection({ fichaId }: Props) {
  useRegistrarConsultaTabAgresor(fichaId);

  const { data: agresores, isLoading, isError, refetch } = useAgresores(fichaId);
  const { data: parentescos = [] } = useParentescos();
  const { data: ocupaciones = [] } = useOcupaciones();
  const { data: asentamientos = [] } = useAsentamientosAhome();
  const { mutate: registrarConsulta } = useRegistrarConsultaAgresor();

  const [mode, setMode] = useState<FormMode>({ kind: 'list' });
  const consultedAgresorRef = useRef<string | null>(null);

  const parentescoById = useMemo(
    () => new Map(parentescos.map((item) => [item.id, item.nombre])),
    [parentescos],
  );
  const ocupacionById = useMemo(
    () => new Map(ocupaciones.map((item) => [item.id, item.nombre])),
    [ocupaciones],
  );
  const asentamientoById = useMemo(
    () => new Map(asentamientos.map((item) => [item.id, item])),
    [asentamientos],
  );

  function handleEdit(agresor: Agresor) {
    if (consultedAgresorRef.current !== agresor.id) {
      consultedAgresorRef.current = agresor.id;
      registrarConsulta({ tabla: 'agresor', registroId: agresor.id });
    }
    setMode({ kind: 'edit', agresor });
  }

  function handleBackToList() {
    consultedAgresorRef.current = null;
    setMode({ kind: 'list' });
  }

  if (mode.kind === 'create' || mode.kind === 'edit') {
    const editingAgresor = mode.kind === 'edit' ? mode.agresor : null;
    return (
      <AgresorForm
        key={editingAgresor?.id ?? 'new'}
        fichaId={fichaId}
        initial={editingAgresor}
        parentescos={parentescos}
        ocupaciones={ocupaciones}
        asentamientos={asentamientos}
        onCancel={handleBackToList}
        onSaved={handleBackToList}
      />
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl bg-surface-container-low p-6">
        <EmptyState
          illustration="error"
          title="No se pudo cargar la información de persona agresora"
          description="Verifica tus permisos o intenta nuevamente."
          actions={RETRY_ACTION}
          onAction={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-on-surface">
            Personas agresoras registradas ({agresores?.length ?? 0})
          </p>
          <p className="text-xs text-on-surface-variant">
            Acceso auditado en bitácora (RF-05 / RF-22)
          </p>
        </div>

        <button
          type="button"
          className="mk-button mk-button--filled mk-button--sm"
          onClick={() => setMode({ kind: 'create' })}
        >
          <Icon name="person_add" />
          <span className="ml-1.5">Agregar persona agresora</span>
        </button>
      </div>

      <Skeleton loading={isLoading} shape="card" lines={4} label="Cargando personas agresoras">
        {!agresores || agresores.length === 0 ? (
          <div className="rounded-2xl bg-surface-container-low p-6">
            <EmptyState
              illustration="inbox"
              title="Sin personas agresoras registradas"
              description="Registra los datos disponibles de la persona agresora vinculada a este expediente."
              actions={EMPTY_ADD_ACTION}
              onAction={() => setMode({ kind: 'create' })}
            />
          </div>
        ) : (
          <div className="grid gap-3">
            {agresores.map((agresor) => {
              const parentescoLabel =
                agresor.parentescoOtro ??
                (agresor.parentescoId ? parentescoById.get(agresor.parentescoId) : null);
              const ocupacionLabel =
                agresor.ocupacionOtra ??
                (agresor.ocupacionId ? ocupacionById.get(agresor.ocupacionId) : null);
              const asentamiento = agresor.asentamientoId
                ? asentamientoById.get(agresor.asentamientoId)
                : null;
              const domicilioResumen = [
                agresor.calle,
                agresor.numeroExterior ? `#${agresor.numeroExterior}` : null,
                asentamiento ? `${asentamiento.nombre} (CP ${asentamiento.codigoPostal})` : null,
                !asentamiento && agresor.codigoPostal ? `CP ${agresor.codigoPostal}` : null,
              ]
                .filter(Boolean)
                .join(', ');

              return (
                <article
                  key={agresor.id}
                  className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-semibold text-on-surface">
                        {formatAgresorNombre(agresor)}
                      </h4>
                      <p className="mt-0.5 text-xs text-on-surface-variant">
                        {[parentescoLabel, ocupacionLabel].filter(Boolean).join(' · ') ||
                          'Sin parentesco ni ocupación registrados'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="mk-button mk-button--tonal mk-button--sm shrink-0"
                      onClick={() => handleEdit(agresor)}
                    >
                      <Icon name="edit" />
                      <span className="ml-1">Editar</span>
                    </button>
                  </div>

                  {domicilioResumen ? (
                    <p className="text-xs text-on-surface-variant">
                      <span className="font-medium text-on-surface">Domicilio:</span> {domicilioResumen}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-1.5">
                    {agresor.tieneConsumoDroga === true ? (
                      <span className="rounded-full bg-status-warning-bg px-2.5 py-0.5 text-xs font-medium text-status-warning">
                        Consumo de drogas
                        {agresor.drogas?.length
                          ? `: ${agresor.drogas.map((d) => DROGA_LABELS[d]).join(', ')}`
                          : ''}
                      </span>
                    ) : null}
                    {agresor.utilizoArmaUObjeto === true ? (
                      <span className="rounded-full bg-status-danger-bg px-2.5 py-0.5 text-xs font-medium text-status-danger">
                        Utilizó arma u objeto
                        {agresor.especificacionArma ? `: ${agresor.especificacionArma}` : ''}
                      </span>
                    ) : null}
                  </div>

                  {agresor.observaciones ? (
                    <p className="line-clamp-3 text-xs text-on-surface-variant">
                      {agresor.observaciones}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </Skeleton>
    </div>
  );
}
