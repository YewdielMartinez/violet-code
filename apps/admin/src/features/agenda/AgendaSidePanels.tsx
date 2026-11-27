import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { toast } from '@yewdiel21/motion-kit/react';
import type { AgendaItem, ListaUrgenciasItem } from '@/domain/models/Cita';
import { Icon } from '@/shared/ui/Icon';
import { useAgenda, useCambiarEstadoCita, useListaUrgencias } from './api';
import { esCitaUmeca, UMECA_BADGE_LABEL } from './citaDialogUtils';
import { SidePanelEmpty, SidePanelError, SidePanelSkeleton } from './sidePanelsCard';
import { useNewIds } from './sidePanelsHooks';
import {
  areaLabel,
  diasDeEspera,
  etiquetaEspera,
  filtrarCitasPorConfirmar,
  formatFechaCorta,
  formatHora,
  telHref,
  tomorrowRange,
} from './sidePanelsUtils';

/**
 * Datos y listas de los avisos de la agenda («Por confirmar · mañana» y «Lista de urgencias»).
 * Los hooks viven aparte de las listas: `AgendaAvisos` los usa para los contadores de la barra
 * y reutiliza el mismo estado dentro de la hoja lateral (el confirmado optimista no se pierde al cerrarla).
 */

const ESTADOS_PENDIENTES = ['agendada'] as const;

/** Máximo de filas con retraso escalonado: las demás entran juntas para no alargar la animación. */
const STAGGER_MAX = 8;

function rowStyle(index: number): CSSProperties {
  return { '--sp-i': Math.min(index, STAGGER_MAX) } as CSSProperties;
}

// ---------------------------------------------------------------------------
// Lista de urgencias
// ---------------------------------------------------------------------------

export interface UrgenciasState {
  items: ListaUrgenciasItem[];
  /** `undefined` mientras carga (no mostrar contador). */
  count: number | undefined;
  fresh: ReadonlySet<string>;
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
}

/** Personas con prioridad alta (`get_lista_urgencias`) que pueden cubrir una cancelación. */
export function useUrgencias(areaId?: number | null): UrgenciasState {
  const { data, isPending, isError, refetch } = useListaUrgencias(areaId);
  const items = useMemo(() => data ?? [], [data]);
  const ids = useMemo(() => items.map((i) => i.fichaId), [items]);
  const fresh = useNewIds(ids, Boolean(data));
  return {
    items,
    count: data ? items.length : undefined,
    fresh,
    isPending,
    isError,
    refetch: () => void refetch(),
  };
}

function UrgenciaRow({ item, fresh, index }: { item: ListaUrgenciasItem; fresh: boolean; index: number }) {
  const href = telHref(item.celular);
  const espera = etiquetaEspera(diasDeEspera(item.fechaUltimaPrioridad));
  return (
    <li className={`sp-row sp-row--urgencia${fresh ? ' sp-row--new' : ''}`} style={rowStyle(index)}>
      <Link
        to={`/expedientes/${encodeURIComponent(item.fichaId)}`}
        className="sp-row__main"
        aria-label={`Abrir expediente ${item.folio} de ${item.nombreCompleto}`}
      >
        <span className="sp-row__name">{item.nombreCompleto}</span>
        <span className="sp-row__sub">
          <span className="sp-chip sp-chip--mono">{item.folio}</span>
          <span>{areaLabel(item.areaUltimaPrioridad)}</span>
        </span>
        <span className="sp-row__meta" title={`Prioridad alta desde ${formatFechaCorta(item.fechaUltimaPrioridad)}`}>
          Desde {formatFechaCorta(item.fechaUltimaPrioridad)}
          {espera ? ` · ${espera.toLowerCase()}` : ''}
        </span>
      </Link>
      <div className="sp-row__actions">
        {href ? (
          <a
            className="sp-act sp-act--tonal"
            href={href}
            aria-label={`Llamar a ${item.nombreCompleto}: ${item.celular}`}
            title={item.celular ?? undefined}
          >
            <Icon name="call" />
            <span>Llamar</span>
          </a>
        ) : (
          <span className="sp-row__nophone" aria-label="Sin celular registrado" title="Sin celular registrado">
            <Icon name="phone_disabled" />
            <span>Sin celular</span>
          </span>
        )}
      </div>
    </li>
  );
}

/** Filas de la lista de urgencias (con carga, error y vacío). */
export function UrgenciasList({ state }: { state: UrgenciasState }) {
  const { items, fresh, isPending, isError, refetch } = state;
  if (isPending) return <SidePanelSkeleton />;
  if (isError) return <SidePanelError message="Verifica tu conexión e inténtalo de nuevo." onRetry={refetch} />;
  if (items.length === 0) {
    return (
      <SidePanelEmpty icon="inbox" title="Sin personas en espera" description="Nadie con prioridad alta sin cita próxima." />
    );
  }
  return (
    <ul className="sp-list" aria-label="Personas en lista de urgencias">
      {items.map((item, i) => (
        <UrgenciaRow key={item.fichaId} item={item} fresh={fresh.has(item.fichaId)} index={i} />
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Citas por confirmar (mañana)
// ---------------------------------------------------------------------------

/** `done`: confirmada (optimista, muestra el check); `leaving`: la fila se colapsa antes de salir. */
type RowPhase = 'done' | 'leaving';

const CHECK_HOLD_MS = 900;
const LEAVE_MS = 260;

export interface PorConfirmarState {
  pendientes: AgendaItem[];
  /** Citas aún sin confirmar (excluye las confirmadas de forma optimista); `undefined` mientras carga. */
  count: number | undefined;
  phases: ReadonlyMap<string, RowPhase>;
  fresh: ReadonlySet<string>;
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
  confirmar: (cita: AgendaItem) => void;
}

/** Citas de mañana en estado `agendada` con confirmación optimista (revierte si la mutación falla). */
export function usePorConfirmar(areaId?: number | null): PorConfirmarState {
  const { desde, hasta } = tomorrowRange();
  // Strings estables por día: el objeto de consulta solo cambia con el día o el área.
  const query = useMemo(
    () => ({ desde, hasta, areaId: areaId ?? null, estados: [...ESTADOS_PENDIENTES] }),
    [desde, hasta, areaId],
  );
  const { data, isPending, isError, refetch } = useAgenda(query);
  const { mutateAsync } = useCambiarEstadoCita();

  const [phases, setPhases] = useState<ReadonlyMap<string, RowPhase>>(() => new Map());
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending) window.clearTimeout(t);
    };
  }, []);

  const setPhase = useCallback((id: string, phase: RowPhase | null) => {
    setPhases((prev) => {
      const next = new Map(prev);
      if (phase === null) next.delete(id);
      else next.set(id, phase);
      return next;
    });
  }, []);

  const confirmar = useCallback(
    (cita: AgendaItem) => {
      // Optimista: el check aparece al instante y la fila se retira poco después.
      setPhase(cita.citaId, 'done');
      const leaving = window.setTimeout(() => setPhase(cita.citaId, 'leaving'), CHECK_HOLD_MS);
      const gone = window.setTimeout(
        () => setHidden((prev) => new Set(prev).add(cita.citaId)),
        CHECK_HOLD_MS + LEAVE_MS,
      );
      timers.current.push(leaving, gone);
      mutateAsync({ citaId: cita.citaId, estado: 'confirmada' })
        .then(() => {
          toast(`Cita de ${cita.nombreCompleto} confirmada.`, { tone: 'success' });
        })
        .catch((err: unknown) => {
          // Revierte la UI optimista.
          window.clearTimeout(leaving);
          window.clearTimeout(gone);
          setPhase(cita.citaId, null);
          setHidden((prev) => {
            const next = new Set(prev);
            next.delete(cita.citaId);
            return next;
          });
          const msg = err instanceof Error && err.message ? err.message : 'No se pudo confirmar la cita.';
          toast(msg, { tone: 'error' });
        });
    },
    [mutateAsync, setPhase],
  );

  const pendientes = useMemo(
    () => filtrarCitasPorConfirmar(data ?? []).filter((c) => !hidden.has(c.citaId)),
    [data, hidden],
  );
  const ids = useMemo(() => pendientes.map((c) => c.citaId), [pendientes]);
  const fresh = useNewIds(ids, Boolean(data));

  return {
    pendientes,
    count: data ? pendientes.filter((c) => !phases.has(c.citaId)).length : undefined,
    phases,
    fresh,
    isPending,
    isError,
    refetch: () => void refetch(),
    confirmar,
  };
}

interface ConfirmRowProps {
  cita: AgendaItem;
  phase: RowPhase | undefined;
  fresh: boolean;
  index: number;
  onOpen: (cita: AgendaItem, anchor: HTMLElement | null) => void;
  onConfirm: (cita: AgendaItem) => void;
}

function ConfirmRow({ cita, phase, fresh, index, onOpen, onConfirm }: ConfirmRowProps) {
  const href = telHref(cita.celular);
  const done = phase !== undefined;
  return (
    <li
      className={`sp-row sp-row--confirmar${fresh ? ' sp-row--new' : ''}`}
      data-phase={phase}
      style={rowStyle(index)}
    >
      <div className="sp-row__collapse">
        <div className="sp-row__inner">
          <button
            type="button"
            className="sp-row__main"
            onClick={(e) => onOpen(cita, e.currentTarget)}
            aria-label={`Abrir cita de ${cita.nombreCompleto} a las ${formatHora(cita.programadaEn)}${esCitaUmeca(cita) ? `, ${UMECA_BADGE_LABEL}` : ''}`}
          >
            <span className="sp-row__time">{formatHora(cita.programadaEn)}</span>
            <span className="sp-row__text">
              <span className="sp-row__name">{cita.nombreCompleto}</span>
              <span className="sp-row__sub">
                <span>{areaLabel(cita.areaClave)}</span>
                {cita.prioridad === 'alta' ? <span className="sp-chip sp-chip--danger">Prioridad alta</span> : null}
                {esCitaUmeca(cita) ? (
                  <span className="sp-chip sp-chip--umeca" title={UMECA_BADGE_LABEL}>
                    UMECA · obligatoria
                  </span>
                ) : null}
              </span>
            </span>
          </button>
          <div className="sp-row__actions">
            {href ? (
              <a
                className="sp-act sp-act--tonal"
                href={href}
                aria-label={`Llamar a ${cita.nombreCompleto}: ${cita.celular}`}
                title={cita.celular ?? undefined}
              >
                <Icon name="call" />
                <span>Llamar</span>
              </a>
            ) : (
              <span className="sp-row__nophone">
                <Icon name="phone_disabled" />
                <span>Sin celular</span>
              </span>
            )}
            <button
              type="button"
              className={`sp-act sp-act--confirm${done ? ' sp-act--done' : ''}`}
              onClick={() => onConfirm(cita)}
              disabled={done}
              aria-label={done ? `Cita de ${cita.nombreCompleto} confirmada` : `Confirmar cita de ${cita.nombreCompleto}`}
            >
              <span className="sp-act__icon" aria-hidden>
                <Icon name={done ? 'check' : 'check_circle'} />
              </span>
              <span>{done ? 'Confirmada' : 'Confirmar'}</span>
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

export interface PorConfirmarListProps {
  state: PorConfirmarState;
  /** Abre el detalle de una cita en el CitaDialog de la página. */
  onOpenCita: (cita: AgendaItem, anchor: HTMLElement | null) => void;
}

/** Filas de citas por confirmar (con carga, error y vacío). */
export function PorConfirmarList({ state, onOpenCita }: PorConfirmarListProps) {
  const { pendientes, phases, fresh, isPending, isError, refetch, confirmar } = state;
  if (isPending) return <SidePanelSkeleton />;
  if (isError) return <SidePanelError message="No se pudieron consultar las citas de mañana." onRetry={refetch} />;
  if (pendientes.length === 0) {
    return (
      <SidePanelEmpty icon="task_alt" title="Todo confirmado para mañana" description="No quedan citas por confirmar." />
    );
  }
  return (
    <ul className="sp-list" aria-label="Citas de mañana por confirmar">
      {pendientes.map((cita, i) => (
        <ConfirmRow
          key={cita.citaId}
          cita={cita}
          phase={phases.get(cita.citaId)}
          fresh={fresh.has(cita.citaId)}
          index={i}
          onOpen={onOpenCita}
          onConfirm={confirmar}
        />
      ))}
    </ul>
  );
}
