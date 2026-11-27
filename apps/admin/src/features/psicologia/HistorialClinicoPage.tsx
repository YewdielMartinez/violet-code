import { useMemo, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState, Skeleton, Timeline } from '@yewdiel21/motion-kit/react';
import type { TimelineProps } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/skeleton';
import '@yewdiel21/motion-kit/css/components/timeline';
import { puedeAccederHistorialClinico, type ExpedienteClinico, type HistorialClinico } from '@/domain/models/HistorialClinico';
import { useAuth } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';
import { IconoEnLinea } from './IconoEnLinea';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useExpedienteClinico } from './api';
import { formatFechaClinica } from './fechaClinica';
import { ObservacionSesionForm } from './ObservacionSesionForm';
import { PrimeraSesionForm } from './PrimeraSesionForm';

const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];

const PREVIA_LABEL = { si: 'Sí', no: 'No', desconocido: 'No se sabe' } as const;

function Aviso({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <p role="status" className="flex items-start gap-2 rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface">
      <IconoEnLinea name={icon} className="text-on-surface-variant" /> <span>{children}</span>
    </p>
  );
}

function ResumenClinico({ historial }: { historial: HistorialClinico }) {
  const previa = historial.tieneAtencionPsicologicaPrevia;
  const campos = [
    ['Motivo de consulta', historial.motivoConsulta],
    ['Antecedentes familiares', historial.antecedentesFamiliares],
    ['Antecedentes personales', historial.antecedentesPersonales],
    ['Observaciones iniciales', historial.observacionesIniciales],
  ] as const;
  return (
    <section aria-labelledby="datos-iniciales" className="rounded-3xl border border-outline-variant bg-surface-container-low p-5 sm:p-6 lg:sticky lg:top-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-container text-on-primary-container">
            <Icon name="clinical_notes" />
          </span>
          <div>
            <h2 id="datos-iniciales" className="text-xl font-semibold text-on-surface">Primera sesión</h2>
            <p className="mt-0.5 text-sm text-on-surface-variant">
              Registrada el <time dateTime={historial.creadoEn}>{formatFechaClinica(historial.creadoEn)}</time>
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary-container px-2.5 py-1 text-xs font-medium text-on-secondary-container">
          <Icon name="psychology" className="text-sm" />
          Atención previa: {PREVIA_LABEL[previa === null ? 'desconocido' : previa ? 'si' : 'no']}
        </span>
      </header>
      <dl className="mt-5 grid gap-3">
        {campos.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-surface p-4">
            <dt className="text-xs font-medium tracking-wide text-on-surface-variant uppercase">{label}</dt>
            <dd className={`mt-1.5 whitespace-pre-wrap wrap-anywhere ${value ? 'text-on-surface' : 'italic text-on-surface-variant'}`}>
              {value || 'Sin registrar'}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ObservacionesPrevias({ expediente }: { expediente: ExpedienteClinico }) {
  const events = useMemo<TimelineProps['events']>(() => {
    const citas = new Map(expediente.citas.map((cita) => [cita.id, cita.programadaEn]));
    const tipos = new Map(expediente.tiposAtencion.map((tipo) => [tipo.id, tipo.nombre]));
    return expediente.atenciones
      .filter((atencion) => atencion.activo && atencion.observaciones)
      .map((atencion) => {
        const fechaCita = atencion.citaId ? citas.get(atencion.citaId) : undefined;
        const fecha = fechaCita ?? atencion.atendidaEn;
        const origen = fechaCita ? 'Cita' : atencion.citaId ? 'Atención con cita asociada' : 'Atención sin cita';
        return { fecha, event: {
          id: atencion.id,
          title: tipos.get(atencion.tipoAtencionId) ?? 'Atención de Psicología',
          // La fecha se formatea en la zona horaria institucional; no se delega al navegador.
          meta: `${formatFechaClinica(fecha)} · ${origen}`,
          description: atencion.observaciones ?? undefined,
          status: 'done' as const,
        } };
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .map(({ event }) => event);
  }, [expediente]);

  return (
    <section aria-labelledby="observaciones-previas" className="rounded-3xl border border-outline-variant bg-surface-container-low p-5 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="observaciones-previas" className="text-xl font-semibold text-on-surface">Observaciones por visita</h2>
        {events.length > 0 && (
          <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 font-mono text-xs text-on-surface-variant">
            {events.length}
          </span>
        )}
      </header>
      {events.length === 0 ? (
        <EmptyState illustration="inbox" title="Sin observaciones por visita"
          description="Aquí aparecerán, de la más reciente a la más antigua, las observaciones registradas." />
      ) : (
        <Timeline events={events} relative={false} locale="es-MX" label="Observaciones guardadas"
          className="vc-timeline-clinico mt-5" />
      )}
    </section>
  );
}

function HistorialClinico({ fichaId, empleadoId }: { fichaId: string; empleadoId: string }) {
  const { data, isPending, isError, refetch } = useExpedienteClinico(fichaId, empleadoId);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="Historial clínico"
        subtitle={data ? `Expediente ${data.folio} · Psicología` : 'Psicología'}
        leading={
          <Link
            to={`/expedientes?expediente=${encodeURIComponent(fichaId)}`}
            aria-label="Volver al expediente"
            title="Volver al expediente"
            className="grid size-9 shrink-0 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Icon name="arrow_back" />
          </Link>
        }
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tertiary-container px-3 py-1 text-xs font-medium text-on-tertiary-container">
            <Icon name="lock" className="text-sm" /> Información confidencial
          </span>
        }
      />

      {isError ? (
        <div className="rounded-3xl bg-surface-container-low p-10">
          <EmptyState illustration="error" title="No se pudo cargar el historial clínico"
            description="Verifica tu conexión e inténtalo de nuevo." actions={RETRY_ACTION} onAction={() => void refetch()} />
        </div>
      ) : (
        <Skeleton loading={isPending} shape="card" lines={6} label="Cargando historial clínico">
          {data === null && (
            <div className="rounded-3xl bg-surface-container-low p-10">
              <EmptyState illustration="search" title="Expediente no disponible"
                description="No encontramos el expediente o no puedes consultarlo." />
            </div>
          )}
          {data && (
            <div className="grid gap-5">
              {!data.puedeRegistrarAtencion && (
                <Aviso icon="info">Psicología solo puede registrar atenciones para personas de 18 años o más.</Aviso>
              )}
              {data.historial ? (
                <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                  <ResumenClinico historial={data.historial} />
                  <div className="grid gap-5">
                    {data.historial.activo && data.puedeRegistrarAtencion && (
                      <ObservacionSesionForm expediente={data} fichaId={fichaId} empleadoId={empleadoId} />
                    )}
                    {!data.historial.activo && <Aviso icon="lock">Historial inactivo. Solo consulta.</Aviso>}
                    <ObservacionesPrevias expediente={data} />
                  </div>
                </div>
              ) : data.puedeRegistrarAtencion ? (
                <PrimeraSesionForm expediente={data} fichaId={fichaId} empleadoId={empleadoId} />
              ) : null}
            </div>
          )}
        </Skeleton>
      )}
    </div>
  );
}

export default function HistorialClinicoPage() {
  const { fichaId } = useParams();
  const { user } = useAuth();
  if (!user || !puedeAccederHistorialClinico(user.role) || !fichaId) return null;
  return <HistorialClinico key={`${user.id}:${fichaId}`} fichaId={fichaId} empleadoId={user.id} />;
}
