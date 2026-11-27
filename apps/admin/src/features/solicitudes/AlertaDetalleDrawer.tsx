import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Drawer,
  FuseButton,
  HoldConfirm,
  Skeleton,
  toast,
} from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/drawer';
import '@yewdiel21/motion-kit/css/components/fuse-button';
import '@yewdiel21/motion-kit/css/components/hold-confirm';
import '@yewdiel21/motion-kit/css/components/skeleton';
import { Icon } from '@/shared/ui/Icon';
import {
  ESTADO_ALERTA_LABELS,
  ORIGEN_ALERTA_LABELS,
  PRIORIDAD_ALERTA_LABELS,
  traducirErrorAlerta,
  useAlertaDetalle,
  useAtenderAlerta,
  useTomarAlerta,
  validateObservacionesAlerta,
  type ColaAlertaItem,
  type EstadoAlerta,
  type OrigenAlerta,
  type PrioridadAlerta,
} from './api';

export interface AlertaDetalleDrawerProps {
  alerta: ColaAlertaItem | null;
  open: boolean;
  canAttend: boolean;
  onOpenChange: (open: boolean) => void;
  onAfterClose?: () => void;
}

const ORIGEN_ICON: Record<OrigenAlerta, string> = {
  app_movil: 'sos',
  telefono: 'call',
  presencial: 'directions_walk',
};

const PRIORIDAD_CHIP_CLASS: Record<PrioridadAlerta, string> = {
  alta: 'bg-status-danger-bg text-status-danger',
  media: 'bg-status-warning-bg text-status-warning',
  baja: 'bg-status-info-bg text-status-info',
};

const ESTADO_CHIP_CLASS: Record<EstadoAlerta, string> = {
  nueva: 'bg-error-container text-on-error-container',
  tomada: 'bg-secondary-container text-on-secondary-container',
  atendida: 'bg-status-success-bg text-status-success',
};

const FUSE_ATENDER_LABELS = {
  primary: 'Concluir atención',
  secondary: 'Cancelar',
  confirm: 'Sí, atender',
  loading: 'Guardando…',
  success: 'Atendida',
  error: 'Error al guardar',
  prompt: '¿Concluir atención de la alerta? Cancelar o Sí, atender',
};

const DATE_TIME_FMT = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Mazatlan',
});

function formatFechaHora(iso: string | null | undefined): string {
  if (!iso) return 'Pendiente';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DATE_TIME_FMT.format(date);
}

/**
 * Panel lateral derecho con el detalle completo de una alerta (`RF-18`, `RF-20`, `RN-16`, `RN-17`).
 * Muestra datos de persona/expediente, colonia reportada, historial de estados y acciones
 * exclusivas de Línea 24/7 (`Tomar` con `HoldConfirm`, `Atender` con `FuseButton`).
 */
export function AlertaDetalleDrawer({
  alerta,
  open,
  canAttend,
  onOpenChange,
  onAfterClose,
}: AlertaDetalleDrawerProps) {
  const observacionesId = useId();
  const [observaciones, setObservaciones] = useState('');
  const [lastAlertaId, setLastAlertaId] = useState<string | null>(null);

  if (alerta && alerta.alertaId !== lastAlertaId) {
    setLastAlertaId(alerta.alertaId);
    setObservaciones('');
  }

  const detalleQuery = useAlertaDetalle(alerta?.alertaId ?? null, open && Boolean(alerta));
  const tomarMutation = useTomarAlerta();
  const atenderMutation = useAtenderAlerta();

  const obsError = validateObservacionesAlerta(observaciones);

  async function handleTomar() {
    if (!alerta) return;
    try {
      await tomarMutation.mutateAsync(alerta.alertaId);
      toast('Alerta tomada y asignada a tu atención.', { tone: 'success' });
    } catch (err) {
      toast(traducirErrorAlerta(err, 'No se pudo tomar la alerta.'), { tone: 'error' });
    }
  }

  async function handleAtender(): Promise<boolean> {
    if (!alerta) return false;
    if (obsError) {
      toast(obsError, { tone: 'error' });
      return false;
    }
    try {
      await atenderMutation.mutateAsync({
        alertaId: alerta.alertaId,
        observaciones: observaciones.trim() || null,
      });
      toast('Alerta marcada como atendida.', { tone: 'success' });
      return true;
    } catch (err) {
      toast(traducirErrorAlerta(err, 'No se pudo concluir la alerta.'), { tone: 'error' });
      return false;
    }
  }

  const detalle = detalleQuery.data;

  return (
    <Drawer.Root side="right" open={open} onOpenChange={onOpenChange} onAfterClose={onAfterClose}>
      <Drawer.Content size="lg" dividers>
        <Drawer.Header>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Drawer.Title>
                {alerta ? `Alerta #${alerta.alertaId.slice(0, 8).toUpperCase()}` : 'Detalle de alerta'}
              </Drawer.Title>
              {alerta ? (
                <>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${PRIORIDAD_CHIP_CLASS[alerta.prioridad]}`}
                  >
                    Prioridad {PRIORIDAD_ALERTA_LABELS[alerta.prioridad].toLowerCase()}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${ESTADO_CHIP_CLASS[alerta.estado]}`}
                  >
                    {ESTADO_ALERTA_LABELS[alerta.estado]}
                  </span>
                </>
              ) : null}
            </div>
            {alerta ? (
              <Drawer.Description className="mt-1 text-sm text-on-surface-variant">
                Canal: {ORIGEN_ALERTA_LABELS[alerta.origen]} · Recibida {formatFechaHora(alerta.creadoEn)}
              </Drawer.Description>
            ) : null}
          </div>
          <Drawer.Close label="Cerrar detalle de alerta" />
        </Drawer.Header>

        <Drawer.Body>
          {alerta ? (
            <div className="grid gap-5">
              {alerta.tieneOrdenVigente ? (
                <div
                  role="status"
                  className="flex items-start gap-3 rounded-2xl border border-outline-variant bg-status-danger-bg p-5 text-status-danger"
                >
                  <Icon name="gavel" className="mt-0.5 shrink-0" />
                  <div className="text-sm sm:text-base">
                    <p className="font-semibold">Orden de protección vigente (RN-17)</p>
                    <p className="opacity-90">
                      Esta persona cuenta con una orden de protección vigente; la prioridad de la alerta se elevó a alta automáticamente.
                    </p>
                  </div>
                </div>
              ) : null}

              <section
                aria-label="Persona y expediente"
                className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-on-surface-variant">
                    <Icon name={ORIGEN_ICON[alerta.origen]} className="text-base" />
                    <span>{ORIGEN_ALERTA_LABELS[alerta.origen]}</span>
                  </div>
                  {alerta.folio ? (
                    <span className="rounded-full bg-surface-container-high px-3 py-1 font-mono text-sm text-on-surface">
                      {alerta.folio}
                    </span>
                  ) : null}
                </div>

                <div>
                  <p className="text-lg font-semibold text-on-surface">
                    {alerta.nombreCompleto ?? 'Alerta sin expediente vinculado'}
                  </p>
                  <p className="mt-1.5 text-base text-on-surface-variant">
                    {alerta.celular ? (
                      <a
                        href={`tel:${alerta.celular}`}
                        className="inline-flex items-center gap-1.5 text-primary hover:underline"
                      >
                        <Icon name="call" className="text-base" />
                        <span>{alerta.celular}</span>
                      </a>
                    ) : (
                      'Sin teléfono de contacto registrado'
                    )}
                  </p>
                </div>

                {alerta.fichaId ? (
                  <div className="pt-1">
                    <Link
                      to={`/expedientes/${encodeURIComponent(alerta.fichaId)}`}
                      className="mk-button mk-button--tonal inline-flex items-center gap-1.5"
                    >
                      <Icon name="folder_shared" />
                      <span>Ver expediente {alerta.folio ?? ''}</span>
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-on-surface-variant">
                    La alerta no está ligada aún a una Ficha Única de Registro.
                  </p>
                )}
              </section>

              <section
                aria-label="Ubicación reportada"
                className="flex items-start gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5"
              >
                <Icon name="location_on" className="mt-0.5 shrink-0 text-primary" />
                <div>
                  <h3 className="text-base font-semibold text-on-surface">Colonia / asentamiento</h3>
                  <p className="mt-1 text-base text-on-surface-variant">
                    {alerta.asentamientoNombre ?? 'Sin colonia reportada (ubicación reservada).'}
                  </p>
                </div>
              </section>

              <section
                aria-label="Historial de atención"
                className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5"
              >
                <h3 className="text-base font-semibold text-on-surface">Historial de la alerta</h3>
                <Skeleton loading={detalleQuery.isLoading} shape="text" lines={3} label="Cargando historial">
                  <ol className="grid gap-2.5 text-base">
                    <li className="flex items-center justify-between gap-2">
                      <span className="text-on-surface-variant">Emitida</span>
                      <span className="font-medium text-on-surface">
                        {formatFechaHora(alerta.creadoEn)}
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span className="text-on-surface-variant">Tomada</span>
                      <span className="font-medium text-on-surface">
                        {alerta.tomadaEn
                          ? `${formatFechaHora(alerta.tomadaEn)}${alerta.atendidaPorNombre ? ` · ${alerta.atendidaPorNombre}` : ''}`
                          : 'Aún sin asignar'}
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span className="text-on-surface-variant">Atendida</span>
                      <span className="font-medium text-on-surface">
                        {formatFechaHora(detalle?.atendidaEn)}
                      </span>
                    </li>
                  </ol>
                  {detalle?.observaciones ? (
                    <div className="mt-3 rounded-xl bg-surface-container-low p-3.5 text-base text-on-surface">
                      <p className="mb-1 text-sm font-medium text-on-surface-variant">
                        Observaciones registradas
                      </p>
                      <p className="whitespace-pre-wrap">{detalle.observaciones}</p>
                    </div>
                  ) : null}
                </Skeleton>
              </section>

              <section
                aria-label="Acciones de atención"
                className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-5"
              >
                <h3 className="text-base font-semibold text-on-surface">Atención Línea 24/7</h3>

                {!canAttend ? (
                  <p className="text-sm sm:text-base text-on-surface-variant">
                    Solo Titular, Subdirección o Jurídico pueden tomar y concluir alertas de la Línea 24/7.
                  </p>
                ) : alerta.estado === 'nueva' ? (
                  <div className="grid gap-2">
                    <p className="text-sm sm:text-base text-on-surface-variant">
                      Mantén presionado el botón para tomar esta alerta de forma atómica y asignarla a tu usuario.
                    </p>
                    <div>
                      <HoldConfirm
                        duration={900}
                        resetAfter={1600}
                        holdingLabel="Tomando alerta…"
                        doneLabel="Alerta tomada"
                        hint="Mantén presionado para tomar"
                        disabled={tomarMutation.isPending}
                        onConfirm={() => {
                          void handleTomar();
                        }}
                      >
                        Tomar alerta
                      </HoldConfirm>
                    </div>
                  </div>
                ) : alerta.estado === 'tomada' ? (
                  <div className="grid gap-3">
                    <div>
                      <label
                        htmlFor={observacionesId}
                        className="mb-1.5 block text-sm sm:text-base font-medium text-on-surface"
                      >
                        Observaciones de atención (opcional)
                      </label>
                      <textarea
                        id={observacionesId}
                        rows={3}
                        maxLength={2000}
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        placeholder="Describe brevemente las acciones realizadas o la canalización efectuada…"
                        className="min-h-28 w-full rounded-2xl border border-outline-variant bg-surface px-4 py-3 text-base text-on-surface focus:border-primary focus:outline-none"
                      />
                      <div className="mt-1.5 flex items-center justify-between text-sm text-on-surface-variant">
                        <span className={obsError ? 'text-status-danger' : ''}>
                          {obsError ?? 'Máximo 2000 caracteres.'}
                        </span>
                        <span>{observaciones.length}/2000</span>
                      </div>
                    </div>

                    <FuseButton
                      mode="split"
                      tone="neutral"
                      resetAfter={1600}
                      labels={FUSE_ATENDER_LABELS}
                      disabled={atenderMutation.isPending || Boolean(obsError)}
                      onConfirm={handleAtender}
                    />
                  </div>
                ) : (
                  <p className="inline-flex items-center gap-2 text-sm sm:text-base font-medium text-status-success">
                    <Icon name="check_circle" />
                    <span>Esta alerta ya fue atendida y cerrada.</span>
                  </p>
                )}
              </section>
            </div>
          ) : null}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer.Root>
  );
}
