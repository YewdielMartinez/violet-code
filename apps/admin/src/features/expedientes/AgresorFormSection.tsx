import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState, Skeleton } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/skeleton';
import { Icon } from '@/shared/ui/Icon';
import {
  useAgresores,
  useAsentamientosAhome,
  useOcupaciones,
  useParentescos,
  useRegistrarConsultaAgresor,
  useRegistrarConsultaTabAgresor,
  type Agresor,
} from './agresorApi';
import { AgresorForm } from './AgresorForm';
import { AgresorCard } from './agresor/AgresorCard';
import { AgresorDialog, AgresorFlipGroup, useAgresorCascade } from './agresor/motionCompat';

const EMPTY_ADD_ACTION = [{ id: 'add', label: 'Agregar persona agresora' }];
const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];
const CASCADE_OPTIONS = { trigger: 'load', duration: 0.42, step: 0.06, once: true } as const;

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

  const [formOpen, setFormOpen] = useState(false);
  const [formMounted, setFormMounted] = useState(false);
  const [editingAgresor, setEditingAgresor] = useState<Agresor | null>(null);
  const consultedAgresorRef = useRef<string | null>(null);
  const formOpenRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    formOpenRef.current = formOpen;
  }, [formOpen]);

  const hasAgresores = Boolean(agresores && agresores.length > 0);
  useAgresorCascade(listRef, CASCADE_OPTIONS, [hasAgresores]);

  const flipSignature = useMemo(
    () =>
      (agresores ?? [])
        .map((item) => `${item.id}:${item.actualizadoEn}:${item.nombres}`)
        .join('|'),
    [agresores],
  );

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

  function handleStartCreate() {
    consultedAgresorRef.current = null;
    setEditingAgresor(null);
    setFormMounted(true);
  }

  function handleOpenCreateFromEmpty() {
    handleStartCreate();
    formOpenRef.current = true;
    setFormOpen(true);
  }

  function handleStartEdit(agresor: Agresor) {
    if (consultedAgresorRef.current !== agresor.id) {
      consultedAgresorRef.current = agresor.id;
      registrarConsulta({ tabla: 'agresor', registroId: agresor.id });
    }
    setEditingAgresor(agresor);
    setFormMounted(true);
  }

  const handleDialogOpenChange = useCallback((nextOpen: boolean) => {
    formOpenRef.current = nextOpen;
    if (nextOpen) setFormMounted(true);
    setFormOpen(nextOpen);
  }, []);

  const handleAfterClose = useCallback(() => {
    if (formOpenRef.current) return;
    consultedAgresorRef.current = null;
    setEditingAgresor(null);
    setFormMounted(false);
  }, []);

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
    <AgresorDialog.Root
      open={formOpen}
      onOpenChange={handleDialogOpenChange}
      onAfterClose={handleAfterClose}
      closeOnBackdrop={false}
      drag={false}
      autoResize={false}
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-base font-semibold text-on-surface">
              Personas agresoras registradas ({agresores?.length ?? 0})
            </p>
            <p className="text-sm text-on-surface-variant">
              Acceso auditado en bitácora (RF-05 / RF-22)
            </p>
          </div>

          <AgresorDialog.Trigger
            className="mk-button mk-button--primary"
            onClick={handleStartCreate}
          >
            <Icon name="person_add" />
            <span>Agregar persona agresora</span>
          </AgresorDialog.Trigger>
        </div>

        <Skeleton loading={isLoading} shape="card" lines={4} label="Cargando personas agresoras">
          {!agresores || agresores.length === 0 ? (
            <div className="rounded-2xl bg-surface-container-low p-6">
              <EmptyState
                illustration="inbox"
                title="Sin personas agresoras registradas"
                description="Registra los datos disponibles de la persona agresora vinculada a este expediente."
                actions={EMPTY_ADD_ACTION}
                onAction={handleOpenCreateFromEmpty}
              />
            </div>
          ) : (
            <AgresorFlipGroup root={listRef} signature={flipSignature}>
              <div ref={listRef} className="grid gap-3">
                {agresores.map((agresor) => {
                  const parentescoLabel =
                    agresor.parentescoOtro ??
                    (agresor.parentescoId ? (parentescoById.get(agresor.parentescoId) ?? null) : null);
                  const ocupacionLabel =
                    agresor.ocupacionOtra ??
                    (agresor.ocupacionId ? (ocupacionById.get(agresor.ocupacionId) ?? null) : null);
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
                    <AgresorCard
                      key={agresor.id}
                      agresor={agresor}
                      parentescoLabel={parentescoLabel}
                      ocupacionLabel={ocupacionLabel}
                      domicilioResumen={domicilioResumen}
                      onEdit={handleStartEdit}
                    />
                  );
                })}
              </div>
            </AgresorFlipGroup>
          )}
        </Skeleton>
      </div>

      <AgresorDialog.Content size="lg" dividers>
        <AgresorDialog.Header>
          <div className="flex min-w-0 items-center gap-3">
            <AgresorDialog.Close label="Cerrar" />
            <AgresorDialog.Title className="truncate">
              {editingAgresor ? 'Editar persona agresora' : 'Agregar persona agresora'}
            </AgresorDialog.Title>
          </div>
        </AgresorDialog.Header>

        {formMounted ? (
          <AgresorForm
            key={editingAgresor?.id ?? 'new'}
            fichaId={fichaId}
            initial={editingAgresor}
            parentescos={parentescos}
            ocupaciones={ocupaciones}
            asentamientos={asentamientos}
            onCancel={() => handleDialogOpenChange(false)}
            onSaved={() => handleDialogOpenChange(false)}
          />
        ) : null}
      </AgresorDialog.Content>
    </AgresorDialog.Root>
  );
}
