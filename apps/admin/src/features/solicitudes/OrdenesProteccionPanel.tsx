import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  EmptyState,
  HoldConfirm,
  Skeleton,
  toast,
} from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/hold-confirm';
import '@yewdiel21/motion-kit/css/components/skeleton';
import { useAuth } from '@/shared/auth/useAuth';
import { DeferredDialogContent, DialogFormSkeleton } from '@/shared/ui/DeferredDialogContent';
import { Icon } from '@/shared/ui/Icon';
import { OrdenProteccionForm } from './OrdenProteccionForm';
import {
  ESTADO_ORDEN_LABELS,
  puedeEscribirOrdenesProteccion,
  puedeVerOrdenesProteccion,
  useAgresoresParaOrden,
  useDesactivarOrdenProteccion,
  useDocumentosOrdenes,
  useObtenerUrlCopiaOrden,
  useOrdenesProteccion,
  type EstadoOrdenProteccion,
  type OrdenProteccion,
} from './ordenesApi';

export interface OrdenesProteccionPanelProps {
  fichaId: string;
}

const ESTADO_CHIP: Record<EstadoOrdenProteccion, string> = {
  vigente: 'bg-status-success-bg text-status-success',
  en_tramite: 'bg-status-warning-bg text-status-warning',
  vencida: 'bg-surface-container-high text-on-surface-variant',
  cancelada: 'bg-status-danger-bg text-status-danger',
};

const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];
/** Alturas (rem) de los bloques del marcador: aproximan el formulario para que el diálogo no cambie de alto al montarlo. */
const FORM_SKELETON_BLOCKS = [5, 5, 5, 13] as const;

/**
 * Panel de Órdenes de Protección para montar dentro del Drawer de un expediente (`RF-17`, `RN-17`).
 * - Consulta: Dirección y áreas de atención (`expediente.ver`).
 * - Escritura: Dirección, Jurídico y Trabajo Social (`orden_proteccion.escribir`).
 * - `recepcion` y `umeca` ven estado de acceso restringido.
 */
export function OrdenesProteccionPanel({ fichaId }: OrdenesProteccionPanelProps) {
  const { user } = useAuth();
  const canView = puedeVerOrdenesProteccion(user?.role);
  const canWrite = puedeEscribirOrdenesProteccion(user?.role);

  const [formOpen, setFormOpen] = useState(false);
  const [formMounted, setFormMounted] = useState(false);
  const [editingOrden, setEditingOrden] = useState<OrdenProteccion | null>(null);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const formOpenRef = useRef(false);

  useEffect(() => {
    formOpenRef.current = formOpen;
  }, [formOpen]);

  const openForm = useCallback((orden: OrdenProteccion | null, origin: HTMLElement | null) => {
    anchorRef.current = origin;
    setEditingOrden(orden);
    formOpenRef.current = true;
    setFormMounted(true);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    formOpenRef.current = false;
    setFormOpen(false);
  }, []);

  const handleAfterClose = useCallback(() => {
    if (formOpenRef.current) return;
    setEditingOrden(null);
    setFormMounted(false);
  }, []);

  const ordenesQuery = useOrdenesProteccion(fichaId, canView);
  const agresoresQuery = useAgresoresParaOrden(fichaId, canView);
  const documentosQuery = useDocumentosOrdenes(fichaId, canView);
  const desactivarMutation = useDesactivarOrdenProteccion(fichaId);
  const urlFirmadaMutation = useObtenerUrlCopiaOrden();

  const agresorNombreById = useMemo(() => {
    const map = new Map<string, string>();
    for (const agr of agresoresQuery.data ?? []) {
      map.set(agr.id, agr.nombre);
    }
    return map;
  }, [agresoresQuery.data]);

  const documentosByOrdenId = useMemo(() => {
    const map = new Map<string, NonNullable<typeof documentosQuery.data>[number][]>();
    for (const doc of documentosQuery.data ?? []) {
      if (!doc.ordenProteccionId) continue;
      const list = map.get(doc.ordenProteccionId) ?? [];
      list.push(doc);
      map.set(doc.ordenProteccionId, list);
    }
    return map;
  }, [documentosQuery.data]);

  if (!canView) {
    return (
      <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-6">
        <EmptyState
          illustration="error"
          title="Acceso restringido"
          description="Tu rol no tiene permisos para consultar ni registrar órdenes de protección."
        />
      </div>
    );
  }

  async function handleAbrirCopia(docId: string, rutaStorage: string, nombreArchivo: string) {
    setActiveDocId(docId);
    try {
      const url = await urlFirmadaMutation.mutateAsync({
        rutaStorage,
        download: nombreArchivo,
      });
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : 'No se pudo obtener el enlace de la copia.',
        { tone: 'error' },
      );
    } finally {
      setActiveDocId(null);
    }
  }

  async function handleArchivar(orden: OrdenProteccion) {
    try {
      await desactivarMutation.mutateAsync({
        id: orden.id,
        actualizadoEnEsperado: orden.actualizadoEn,
      });
      toast('Orden de protección archivada.', { tone: 'success' });
    } catch (err) {
      toast(
        err instanceof Error ? err.message : 'No se pudo archivar la orden de protección.',
        { tone: 'error' },
      );
    }
  }

  const ordenes = ordenesQuery.data ?? [];
  const hayOrdenVigente = ordenes.some((o) => o.vigente);

  return (
    <section aria-label="Órdenes de protección" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm sm:text-base text-on-surface-variant">
            Órdenes de protección del expediente. Si existe al menos una vigente, las alertas de la persona escalan a prioridad alta (RN-17).
          </p>
        </div>

        {canWrite ? (
          <button
            type="button"
            className="mk-button mk-button--filled"
            onClick={(e) => openForm(null, e.currentTarget)}
          >
            <Icon name="gavel" />
            <span className="ml-1.5">Nueva orden</span>
          </button>
        ) : null}
      </div>

      {hayOrdenVigente ? (
        <div className="flex items-center gap-2.5 rounded-2xl border border-outline-variant bg-status-danger-bg px-4 py-2.5 text-sm font-medium text-status-danger">
          <Icon name="verified_user" />
          <span>Expediente con orden de protección vigente hoy</span>
        </div>
      ) : null}

      {ordenesQuery.isError ? (
        <EmptyState
          illustration="error"
          title="No se pudieron cargar las órdenes de protección"
          actions={RETRY_ACTION}
          onAction={() => {
            void ordenesQuery.refetch();
          }}
        />
      ) : (
        <Skeleton loading={ordenesQuery.isLoading} shape="card" lines={3} label="Cargando órdenes">
          {ordenes.length === 0 ? (
            <EmptyState
              illustration="inbox"
              title="Sin órdenes de protección registradas"
              description={
                canWrite
                  ? 'Registra aquí las órdenes emitidas por autoridad judicial o ministerial.'
                  : 'No hay órdenes de protección registradas en este expediente.'
              }
            />
          ) : (
            <ul className="grid gap-3">
              {ordenes.map((orden) => {
                const agresorNombre = orden.agresorId
                  ? agresorNombreById.get(orden.agresorId) ?? 'Persona agresora vinculada'
                  : null;
                const copias = documentosByOrdenId.get(orden.id) ?? [];

                return (
                  <li
                    key={orden.id}
                    className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-on-surface">
                            Oficio {orden.numeroOficio ?? 'sin número'}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-sm font-medium ${ESTADO_CHIP[orden.estado]}`}
                          >
                            {ESTADO_ORDEN_LABELS[orden.estado]}
                          </span>
                          {orden.vigente ? (
                            <span className="rounded-full bg-status-danger-bg px-3 py-1 text-sm font-medium text-status-danger">
                              Vigente hoy
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm sm:text-[0.95rem] text-on-surface-variant">
                          {orden.autoridadEmisora ?? 'Autoridad no especificada'}
                        </p>
                      </div>

                      {canWrite ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="mk-button mk-button--tonal"
                            onClick={(e) => openForm(orden, e.currentTarget)}
                          >
                            Editar
                          </button>
                          <HoldConfirm
                            duration={900}
                            resetAfter={1600}
                            holdingLabel="Archivando…"
                            doneLabel="Archivada"
                            disabled={desactivarMutation.isPending}
                            onConfirm={() => {
                              void handleArchivar(orden);
                            }}
                          >
                            Archivar
                          </HoldConfirm>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm sm:text-[0.95rem] text-on-surface-variant">
                      <span>Emisión: {orden.fechaEmision}</span>
                      <span>
                        Vigencia: {orden.fechaVigencia ?? 'Sin fecha de vencimiento'}
                      </span>
                      {agresorNombre ? <span>Agresor: {agresorNombre}</span> : null}
                    </div>

                    {copias.length > 0 ? (
                      <div className="grid gap-1.5 border-t border-outline-variant pt-2.5">
                        <span className="text-sm font-medium text-on-surface-variant">
                          Copias adjuntas
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {copias.map((doc) => (
                            <button
                              key={doc.id}
                              type="button"
                              disabled={activeDocId === doc.id}
                              onClick={() => {
                                void handleAbrirCopia(doc.id, doc.rutaStorage, doc.nombreArchivo);
                              }}
                              className="mk-button mk-button--text mk-button--sm inline-flex items-center gap-1"
                            >
                              <Icon name="description" className="text-base" />
                              <span className="max-w-48 truncate">{doc.nombreArchivo}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Skeleton>
      )}

      <Dialog.Root
        open={formOpen}
        anchor={anchorRef}
        onOpenChange={(nextOpen) => {
          formOpenRef.current = nextOpen;
          setFormOpen(nextOpen);
          if (nextOpen) setFormMounted(true);
        }}
        onAfterClose={handleAfterClose}
        closeOnBackdrop={false}
        animateContent={false}
        drag={false}
        autoResize={false}
      >
        <Dialog.Content size="lg" dividers className="vc-perf-dialog">
          <Dialog.Header>
            <div className="flex min-w-0 items-center gap-3">
              <Dialog.Close label="Cerrar formulario" />
              <Dialog.Title className="truncate">
                {editingOrden ? 'Editar orden de protección' : 'Registrar orden de protección'}
              </Dialog.Title>
            </div>
          </Dialog.Header>

          <DeferredDialogContent
            active={formMounted}
            fallback={<DialogFormSkeleton blocks={FORM_SKELETON_BLOCKS} />}
          >
            <OrdenProteccionForm
              key={editingOrden?.id ?? 'new'}
              fichaId={fichaId}
              orden={editingOrden}
              agresores={agresoresQuery.data ?? []}
              onCancel={closeForm}
              onSuccess={closeForm}
            />
          </DeferredDialogContent>
        </Dialog.Content>
      </Dialog.Root>
    </section>
  );
}
