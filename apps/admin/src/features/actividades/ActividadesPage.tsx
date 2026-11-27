import { useCallback, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { EmptyState } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import { puedeRegistrarActividad } from '@/domain/models/ActividadPreventiva';
import { useAuth } from '@/shared/auth/useAuth';
import { PageHeader } from '@/shared/ui/PageHeader';
import { ToolbarPrimaryButton } from '@/shared/ui/Toolbar';
import { useActividadesPreventivas } from './api';
import { ActividadCard } from './ActividadCard';
import { ActividadDialog, type ActividadDialogState } from './ActividadDialog';
import { ActividadesFilters } from './ActividadesFilters';
import {
  ACTIVIDADES_LIMITE,
  FILTROS_INICIALES,
  agruparActividadesPorDia,
  construirFiltrosServidor,
  filtrarActividades,
  type ActividadListFilters,
} from './actividadesList';
import './actividades.css';

const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];
const CLEAR_ACTION = [{ id: 'clear', label: 'Limpiar filtros' }];
const CREATE_ACTION = [{ id: 'create', label: 'Nueva actividad' }];
const SKELETON_ROWS = [0, 1, 2, 3];

const EMPTY_COPY = {
  pendientes: {
    title: 'No hay actividades pendientes',
    description: 'Programa la próxima capacitación, taller o visita para que el equipo sepa a dónde ir.',
  },
  realizadas: {
    title: 'Aún no hay actividades realizadas',
    description: 'Las actividades cuya fecha ya pasó aparecen aquí como realizadas.',
  },
  todas: {
    title: 'Todavía no hay actividades registradas',
    description: 'Registra la primera actividad preventiva para empezar el historial.',
  },
} as const;

/** Reloj de la pantalla redondeado al minuto: estable entre renders, así la consulta no se repite sin necesidad. */
function ahoraAlMinuto(): Date {
  return new Date(Math.floor(Date.now() / 60_000) * 60_000);
}

/**
 * Actividades preventivas (`RF-16`): agenda de capacitaciones, talleres y jornadas en escuelas, empresas e
 * instituciones. Distingue las pendientes (fecha por venir) de las realizadas (fecha pasada); `actividad.ver` es de
 * todo el personal y solo dirección y áreas de atención ven «Nueva actividad» (`actividad.registrar`).
 */
export default function ActividadesPage() {
  const { user } = useAuth();
  const puedeRegistrar = puedeRegistrarActividad(user?.role);

  const [filtros, setFiltros] = useState<ActividadListFilters>(FILTROS_INICIALES);
  const [ahora, setAhora] = useState(ahoraAlMinuto);
  const [dialogState, setDialogState] = useState<ActividadDialogState | null>(null);
  const [dialogAnchor, setDialogAnchor] = useState<HTMLElement | null>(null);

  const cambiarFiltros = useCallback((patch: Partial<ActividadListFilters>) => {
    setFiltros((prev) => ({ ...prev, ...patch }));
    // Al cambiar de pestaña o de rango se toma un nuevo «ahora» para la frontera pendiente/realizada.
    if ('tab' in patch || 'desde' in patch || 'hasta' in patch) setAhora(ahoraAlMinuto());
  }, []);

  const filtrosServidor = useMemo(() => construirFiltrosServidor(filtros, ahora), [filtros, ahora]);
  const sinRango = filtrosServidor === null;
  const query = useActividadesPreventivas(filtrosServidor ?? undefined, !sinRango);
  const loading = !sinRango && query.isPending;
  const isError = !sinRango && query.isError;

  const visibles = useMemo(
    () => (sinRango ? [] : filtrarActividades(query.data ?? [], filtros, ahora)),
    [sinRango, query.data, filtros, ahora],
  );
  const grupos = useMemo(() => agruparActividadesPorDia(visibles, ahora), [visibles, ahora]);
  const porId = useMemo(() => new Map(visibles.map((a) => [a.id, a])), [visibles]);

  const hayFiltros =
    filtros.busqueda !== '' || filtros.tipoInstitucion !== '' || filtros.desde !== '' || filtros.hasta !== '';
  const truncado = (query.data?.length ?? 0) >= ACTIVIDADES_LIMITE;

  const openCrear = useCallback((el: HTMLElement | null) => {
    setDialogAnchor(el);
    setDialogState({ kind: 'crear' });
  }, []);

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
  if (isError) {
    content = (
      <div className="act-panel act-panel--center">
        <EmptyState
          illustration="error"
          title="No se pudieron cargar las actividades"
          description="Verifica tu conexión e inténtalo de nuevo."
          actions={RETRY_ACTION}
          onAction={() => void query.refetch()}
        />
      </div>
    );
  } else if (loading) {
    content = (
      <div className="act-list" role="status" aria-busy="true" aria-label="Cargando actividades">
        {SKELETON_ROWS.map((row) => (
          <div key={row} className="act-skel" style={{ animationDelay: `${row * 120}ms` }} />
        ))}
      </div>
    );
  } else if (grupos.length === 0) {
    content = (
      <div className="act-panel act-panel--center">
        {hayFiltros || sinRango ? (
          <EmptyState
            illustration="search"
            title="Sin actividades con estos filtros"
            description={
              sinRango
                ? 'El rango de fechas no tiene actividades de este estado. Ajusta las fechas.'
                : 'Prueba con otra búsqueda, otro tipo de institución o un rango distinto.'
            }
            actions={CLEAR_ACTION}
            onAction={limpiar}
          />
        ) : (
          <EmptyState
            illustration="inbox"
            title={empty.title}
            description={empty.description}
            actions={puedeRegistrar ? CREATE_ACTION : undefined}
            onAction={() => openCrear(null)}
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
    );
  }

  return (
    <>
      <PageHeader
        title="Actividades"
        subtitle="Capacitaciones, talleres y jornadas: dónde ya fuimos y a dónde vamos"
        actions={
          puedeRegistrar ? (
            <ToolbarPrimaryButton label="Nueva actividad" showLabel onClick={(event) => openCrear(event.currentTarget)} />
          ) : null
        }
      />

      <div className="act-page">
        <ActividadesFilters filtros={filtros} onChange={cambiarFiltros} />

        {!loading && !isError && visibles.length > 0 ? (
          <p className="act-count" role="status">
            {visibles.length === 1 ? '1 actividad' : `${visibles.length} actividades`}
            {truncado ? ` · se muestran como máximo ${ACTIVIDADES_LIMITE}; acota con el rango de fechas` : ''}
          </p>
        ) : null}

        {content}
      </div>

      <ActividadDialog state={dialogState} onClose={closeDialog} anchor={dialogAnchor} ahora={ahora} />
    </>
  );
}
