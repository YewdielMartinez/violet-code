import { useMemo, useState } from 'react';
import { EmptyState, Skeleton } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/skeleton';
import { ESTADO_CITA_LABELS, PRIORIDAD_CITA_LABELS, type EstadoCita } from '@/domain/models/Cita';
import {
  citaAdmiteHojaSeguimiento,
  ordenarCitasIntervencion,
  puedeAgendarProximaCita,
  puedeRegistrarHojaSeguimiento,
  rangoAgendaIntervenciones,
} from '@/domain/models/HojaSeguimiento';
import { isSupervisor, useAuth } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';
import { PageHeader } from '@/shared/ui/PageHeader';
import { IntervencionDrawer } from './IntervencionDrawer';
import { useAgenda } from './api';
import { formatDia, formatHora } from './formatters';

type Filtro = 'pendientes' | 'todas';

const FILTROS: readonly { id: Filtro; label: string }[] = [
  { id: 'pendientes', label: 'Por atender' },
  { id: 'todas', label: 'Todas (últimos 7 días)' },
];

const ESTADO_BADGE: Record<EstadoCita, string> = {
  agendada: 'bg-surface-container-high text-on-surface-variant',
  confirmada: 'bg-status-info-bg text-status-info',
  asistio: 'bg-status-success-bg text-status-success',
  no_asistio: 'bg-status-warning-bg text-status-warning',
  cancelada: 'bg-error-container text-on-error-container',
  reagendada: 'bg-secondary-container text-on-secondary-container',
};

const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];

/**
 * Intervenciones (`RF-09`, `RF-10`, `RF-25`, `RN-13`): citas recientes del área para registrar la
 * hoja de seguimiento, con línea de tiempo y notas privadas en un panel lateral.
 * Trabajo Social, Psicología y Jurídico registran; Titular y Subdirección solo consultan la línea de tiempo.
 */
export default function IntervencionesPage() {
  const { user } = useAuth();
  const canRegister = puedeRegistrarHojaSeguimiento(user?.role);
  const canView = canRegister || isSupervisor(user?.role);

  const [filtro, setFiltro] = useState<Filtro>('pendientes');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rango] = useState(() => rangoAgendaIntervenciones(new Date()));

  const agendaQuery = useAgenda(
    { ...rango, areaId: canRegister ? user?.areaId : null, limite: 200 },
    canView,
  );

  const citas = useMemo(() => {
    const ordenadas = ordenarCitasIntervencion(agendaQuery.data ?? []);
    return filtro === 'pendientes'
      ? ordenadas.filter((c) => citaAdmiteHojaSeguimiento(c.estado))
      : ordenadas;
  }, [agendaQuery.data, filtro]);

  const selected = useMemo(
    () => (agendaQuery.data ?? []).find((c) => c.citaId === selectedId) ?? null,
    [agendaQuery.data, selectedId],
  );

  if (!canView) {
    return (
      <>
        <PageHeader title="Intervenciones" subtitle="Hojas de seguimiento por sesión." />
        <div className="rounded-3xl bg-surface-container-low p-10">
          <EmptyState
            illustration="error"
            title="Acceso restringido"
            description="Solo Trabajo Social, Psicología, Jurídico y Dirección consultan las intervenciones de los expedientes."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Intervenciones"
        subtitle={
          canRegister
            ? `Citas de ${user?.areaNombre ?? 'tu área'}: registra asistencia y hoja de seguimiento.`
            : 'Consulta de citas y línea de tiempo de los expedientes.'
        }
      />

      {!canRegister ? (
        <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
          <Icon name="visibility" className="shrink-0 text-primary" />
          <span>Vista de solo lectura: las hojas de seguimiento las registra cada área de atención.</span>
        </div>
      ) : null}

      <div role="group" aria-label="Filtrar citas" className="mb-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filtro === f.id}
            onClick={() => setFiltro(f.id)}
            className={`mk-chip mk-chip--filter ${
              filtro === f.id ? 'bg-secondary-container text-on-secondary-container' : ''
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {agendaQuery.isError ? (
        <div className="rounded-3xl bg-surface-container-low p-10">
          <EmptyState
            illustration="error"
            title="No se pudo cargar la agenda"
            description="Verifica tu conexión y permisos."
            actions={RETRY_ACTION}
            onAction={() => void agendaQuery.refetch()}
          />
        </div>
      ) : (
        <Skeleton loading={agendaQuery.isLoading} shape="card" lines={5} label="Cargando citas">
          {citas.length === 0 ? (
            <div className="rounded-3xl bg-surface-container-low p-10">
              <EmptyState
                illustration="inbox"
                title={filtro === 'pendientes' ? 'Sin citas por atender' : 'Sin citas recientes'}
                description="Las citas agendadas de los últimos 7 días y de mañana aparecerán aquí."
              />
            </div>
          ) : (
            <ul className="grid gap-3">
              {citas.map((cita) => {
                const pendiente = citaAdmiteHojaSeguimiento(cita.estado);
                return (
                  <li
                    key={cita.citaId}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 transition-colors hover:bg-surface-container-low"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3.5">
                      <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary-container text-center text-on-primary-container">
                        <span className="text-sm leading-tight font-medium">
                          {formatHora(cita.programadaEn)}
                        </span>
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-on-surface sm:text-lg">
                            {cita.nombreCompleto}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-sm font-medium ${ESTADO_BADGE[cita.estado]}`}
                          >
                            {ESTADO_CITA_LABELS[cita.estado]}
                          </span>
                          {cita.prioridad ? (
                            <span className="rounded-full bg-surface-container-high px-3 py-1 text-sm font-medium text-on-surface-variant">
                              Prioridad {PRIORIDAD_CITA_LABELS[cita.prioridad].toLowerCase()}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1.5 text-sm sm:text-[0.95rem] text-on-surface-variant">
                          {formatDia(cita.programadaEn)}
                          {canRegister ? '' : ` · ${cita.areaClave.replace('_', ' ')}`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(cita.citaId);
                        setDrawerOpen(true);
                      }}
                      className={`mk-button ${
                        canRegister && pendiente ? 'mk-button--filled' : 'mk-button--tonal'
                      }`}
                    >
                      {canRegister && pendiente ? 'Registrar sesión' : 'Ver expediente'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Skeleton>
      )}

      <IntervencionDrawer
        cita={selected}
        open={drawerOpen && Boolean(selected)}
        canRegister={canRegister}
        permiteAgendar={puedeAgendarProximaCita(user?.role)}
        areaId={user?.areaId ?? null}
        onOpenChange={setDrawerOpen}
        onAfterClose={() => setSelectedId(null)}
      />
    </>
  );
}
