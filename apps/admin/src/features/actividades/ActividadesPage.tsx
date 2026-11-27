import { useCallback, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import { puedeRegistrarActividad } from '@/domain/models/ActividadPreventiva';
import { useAuth } from '@/shared/auth/useAuth';
import { PageHeader } from '@/shared/ui/PageHeader';
import { SkeletonRows } from '@/shared/ui/SkeletonRows';
import { SmallEmptyState } from '@/shared/ui/SmallEmptyState';
import { useActividadesPreventivas } from './api';
import { ActividadCard } from './ActividadCard';
import { ActividadDialog, type ActividadDialogState } from './ActividadDialog';
import { ActividadesToolbar } from './ActividadesToolbar';
import {
  ACTIVIDADES_LIMITE,
  FILTROS_INICIALES,
  TAB_ORDEN,
  agruparActividadesPorDia,
  construirFiltrosServidor,
  filtrarActividades,
  hayFiltrosActivos,
  type ActividadListFilters,
} from './actividadesList';
import './actividades.css';

type SlideDirection = 'none' | 'next' | 'prev';

const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];
const SKELETON_ROW_HEIGHT = '6.75rem';

const LEGEND = [
  { tone: 'pendiente', label: 'Pendiente' },
  { tone: 'vencida', label: 'Vencida (por cerrar)' },
  { tone: 'realizada', label: 'Realizada' },
  { tone: 'cancelada', label: 'Cancelada' },
] as const;

const EMPTY_COPY = {
  pendientes: {
    icon: 'event_upcoming',
    title: 'No hay actividades pendientes',
    description: 'Programa la próxima capacitación, taller o visita para que el equipo sepa a dónde ir.',
  },
  realizadas: {
    icon: 'task_alt',
    title: 'Aún no hay actividades realizadas',
    description: 'Cuando cierres una actividad pendiente como realizada, aparecerá aquí.',
  },
  canceladas: {
    icon: 'event_busy',
    title: 'No hay actividades canceladas',
    description: 'Las actividades que se cancelen quedan aquí; puedes reabrirlas si se reprograman.',
  },
  todas: {
    icon: 'inbox',
    title: 'Todavía no hay actividades registradas',
    description: 'Registra la primera actividad preventiva para empezar el historial.',
  },
} as const;

/** Reloj de la pantalla redondeado al minuto: estable entre renders (decide «Hoy», «Mañana» y «Vencida»). */
function ahoraAlMinuto(): Date {
  return new Date(Math.floor(Date.now() / 60_000) * 60_000);
}

/**
 * Actividades preventivas (`RF-16`): agenda de capacitaciones, talleres y jornadas en escuelas, empresas e
 * instituciones. Cada actividad tiene un estado explícito (pendiente / realizada / cancelada) y las pestañas lo
 * filtran en el servidor; una pendiente cuya fecha ya pasó se marca «Vencida» (hay que cerrarla). `actividad.ver` es
 * de todo el personal y solo dirección y áreas de atención ven «Nueva actividad» y las acciones (`actividad.registrar`).
 */
export default function ActividadesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const puedeRegistrar = puedeRegistrarActividad(user?.role);

  const [filtros, setFiltros] = useState<ActividadListFilters>(FILTROS_INICIALES);
  const [direction, setDirection] = useState<SlideDirection>('none');
  const [ahora, setAhora] = useState(ahoraAlMinuto);
  const [dialogState, setDialogState] = useState<ActividadDialogState | null>(null);
  const [dialogAnchor, setDialogAnchor] = useState<HTMLElement | null>(null);

  const tabActual = filtros.tab;
  const cambiarFiltros = useCallback(
    (patch: Partial<ActividadListFilters>) => {
      // El contenido se desliza según la posición de la pestaña (mismo gesto que el cambio de periodo en Agenda).
      if (patch.tab && patch.tab !== tabActual) {
        setDirection(TAB_ORDEN.indexOf(patch.tab) > TAB_ORDEN.indexOf(tabActual) ? 'next' : 'prev');
      }
      setFiltros((prev) => ({ ...prev, ...patch }));
      // Al cambiar de pestaña o de rango se toma un nuevo «ahora» para las etiquetas de día y las vencidas.
      if ('tab' in patch || 'desde' in patch || 'hasta' in patch) setAhora(ahoraAlMinuto());
    },
    [tabActual],
  );

  const filtrosServidor = useMemo(() => construirFiltrosServidor(filtros), [filtros]);
  const sinRango = filtrosServidor === null;
  const query = useActividadesPreventivas(filtrosServidor ?? undefined, !sinRango);
  const loading = !sinRango && query.isPending;
  const isError = !sinRango && query.isError;

  const visibles = useMemo(
    () => (sinRango ? [] : filtrarActividades(query.data ?? [], filtros)),
    [sinRango, query.data, filtros],
  );
  const grupos = useMemo(() => agruparActividadesPorDia(visibles, ahora), [visibles, ahora]);
  const porId = useMemo(() => new Map(visibles.map((a) => [a.id, a])), [visibles]);
  const todosPorId = useMemo(() => new Map((query.data ?? []).map((a) => [a.id, a])), [query.data]);

  // Tras un cambio de estado la lista se refresca: el diálogo lee la versión más nueva si sigue en la consulta.
  const liveDialogState = useMemo<ActividadDialogState | null>(() => {
    if (dialogState?.kind !== 'detalle') return dialogState;
    return { ...dialogState, actividad: todosPorId.get(dialogState.actividad.id) ?? dialogState.actividad };
  }, [dialogState, todosPorId]);

  const hayFiltros = hayFiltrosActivos(filtros);
  const truncado = (query.data?.length ?? 0) >= ACTIVIDADES_LIMITE;

  const openCrear = useCallback(() => navigate('/actividades/nuevo'), [navigate]);

  const onListClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const card = (event.target as HTMLElement).closest<HTMLElement>('[data-actividad-id]');
      const actividad = card ? porId.get(card.dataset.actividadId ?? '') : undefined;
      if (!card || !actividad) return;
      setDialogAnchor(card);
      setDialogState({ kind: 'detalle', actividad });
    },
    [porId],
  );

  const closeDialog = useCallback(() => setDialogState(null), []);
  const limpiar = useCallback(
    () => cambiarFiltros({ ...FILTROS_INICIALES, tab: filtros.tab }),
    [cambiarFiltros, filtros.tab],
  );

  const empty = EMPTY_COPY[filtros.tab];
  let content: ReactNode;
  if (loading) {
    content = <SkeletonRows label="Cargando actividades" rows={4} rowHeight={SKELETON_ROW_HEIGHT} />;
  } else if (grupos.length === 0) {
    content = (
      <div className="act-empty">
        {hayFiltros || sinRango ? (
          <SmallEmptyState
            icon="search"
            title="Sin actividades con estos filtros"
            description={
              sinRango
                ? 'El rango de fechas no es válido: la fecha «desde» es posterior a «hasta».'
                : 'Prueba con otra búsqueda, otro tipo de institución o un rango distinto.'
            }
            action={{ label: 'Limpiar filtros', onClick: limpiar }}
          />
        ) : (
          <SmallEmptyState
            icon={empty.icon}
            title={empty.title}
            description={empty.description}
            action={puedeRegistrar && filtros.tab !== 'canceladas' ? { label: 'Nueva actividad', onClick: openCrear } : undefined}
          />
        )}
      </div>
    );
  } else {
    // Posición global de la primera tarjeta de cada grupo (escalona la entrada a lo largo de toda la lista).
    const inicios = grupos.reduce<number[]>((acc, _grupo, i) => {
      acc.push(i === 0 ? 0 : acc[i - 1] + grupos[i - 1].items.length);
      return acc;
    }, []);
    content = (
      <>
        <p className="act-count" role="status">
          {visibles.length === 1 ? '1 actividad' : `${visibles.length} actividades`}
          {truncado ? ` · se muestran como máximo ${ACTIVIDADES_LIMITE}; acota con el rango de fechas` : ''}
        </p>
        <div className="act-list" onClick={onListClick}>
          {grupos.map((grupo, g) => (
            <section key={grupo.key} className="act-group" aria-label={grupo.etiqueta}>
              <h2 className="act-group__title" data-estado={grupo.estado}>
                {grupo.etiqueta}
                <span className="act-group__count">{grupo.items.length}</span>
              </h2>
              <div className="act-group__items">
                {grupo.items.map((actividad, i) => (
                  <ActividadCard key={actividad.id} actividad={actividad} ahora={ahora} index={inicios[g] + i} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Actividades"
        actions={<ActividadesToolbar filtros={filtros} onChange={cambiarFiltros} onCrear={puedeRegistrar ? openCrear : undefined} />}
      />

      <div className="act-page">
        {isError ? (
          <div className="vc-card vc-card--center">
            <EmptyState
              illustration="error"
              title="No se pudieron cargar las actividades"
              description="Verifica tu conexión e inténtalo de nuevo."
              actions={RETRY_ACTION}
              onAction={() => void query.refetch()}
            />
          </div>
        ) : (
          <section className="vc-card" aria-label="Lista de actividades">
            <div key={filtros.tab} className="vc-stage" data-direction={direction}>
              {content}
            </div>
            <ul className="act-legend" aria-label="Colores de las actividades">
              {LEGEND.map((item) => (
                <li key={item.tone}>
                  <span className="act-legend__dot" data-tone={item.tone} aria-hidden />
                  {item.label}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <ActividadDialog
        state={liveDialogState}
        onClose={closeDialog}
        anchor={dialogAnchor}
        ahora={ahora}
        puedeRegistrar={puedeRegistrar}
      />
    </>
  );
}
