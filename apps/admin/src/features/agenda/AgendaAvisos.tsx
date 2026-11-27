import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Drawer } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import '@yewdiel21/motion-kit/css/components/drawer';
import type { AgendaItem } from '@/domain/models/Cita';
import { Icon } from '@/shared/ui/Icon';
import { PorConfirmarList, UrgenciasList, usePorConfirmar, useUrgencias } from './AgendaSidePanels';
import { formatDiaCorto } from './sidePanelsUtils';
import './agendaAvisos.css';

type AvisoKind = 'confirmar' | 'urgencias';
type SheetSide = 'right' | 'bottom';

interface SheetState {
  kind: AvisoKind;
  open: boolean;
  side: SheetSide;
}

/** Ancho por debajo del cual el kit pasa el panel lateral a pantalla casi completa (móvil). */
const NARROW_QUERY = '(max-width: 679px)';

function sheetSide(): SheetSide {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(NARROW_QUERY).matches
    ? 'bottom'
    : 'right';
}

/**
 * Contador que "salta" cuando cambia (no en el primer render). Se deriva durante el render
 * (sin efectos): la `key` nueva remonta el `<span>` y reinicia la animación CSS.
 */
function useCountPop(count: number): number {
  const [prev, setPrev] = useState(count);
  const [tick, setTick] = useState(0);
  if (prev !== count) {
    setPrev(count);
    setTick((t) => t + 1);
  }
  return tick;
}

interface AvisoPillProps {
  kind: AvisoKind;
  count: number;
  icon: string;
  label: string;
  onOpen: (kind: AvisoKind, trigger: HTMLButtonElement) => void;
}

function AvisoPill({ kind, count, icon, label, onOpen }: AvisoPillProps) {
  const tick = useCountPop(count);
  return (
    <button
      type="button"
      className={`av-pill av-pill--${kind}`}
      aria-haspopup="dialog"
      aria-label={`${count} ${label}`}
      onClick={(e) => onOpen(kind, e.currentTarget)}
    >
      <span className="av-pill__icon" aria-hidden>
        <Icon name={icon} />
      </span>
      <span key={tick} className="av-pill__count" data-pop={tick > 0 ? '' : undefined} aria-hidden>
        {count}
      </span>
      <span className="av-pill__label" aria-hidden>
        {label}
      </span>
    </button>
  );
}

export interface AgendaAvisosProps {
  areaId?: number | null;
  /** Abre el detalle de una cita en el CitaDialog de la página. */
  onOpenCita: (cita: AgendaItem, anchor: HTMLElement | null) => void;
}

/**
 * Barra compacta de avisos bajo la barra de herramientas: «N por confirmar mañana» y
 * «N en lista de urgencias». Cada píldora abre una hoja lateral (inferior en móvil) con la lista.
 * Una píldora sin pendientes no se muestra; sin ninguna, queda un texto discreto.
 */
export function AgendaAvisos({ areaId, onOpenCita }: AgendaAvisosProps) {
  const porConfirmar = usePorConfirmar(areaId);
  const urgencias = useUrgencias(areaId);
  const [sheet, setSheet] = useState<SheetState>({ kind: 'confirmar', open: false, side: 'right' });
  const triggerRef = useRef<HTMLElement | null>(null);

  const openSheet = useCallback((kind: AvisoKind, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setSheet({ kind, open: true, side: sheetSide() });
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) setSheet((s) => (s.open ? { ...s, open: false } : s));
  }, []);

  // La cita se abre en su propio diálogo: la hoja se cierra y el morph parte de la píldora.
  const handleOpenCita = useCallback(
    (cita: AgendaItem) => {
      setSheet((s) => ({ ...s, open: false }));
      onOpenCita(cita, triggerRef.current);
    },
    [onOpenCita],
  );

  const nConfirmar = porConfirmar.count ?? 0;
  const nUrgencias = urgencias.count ?? 0;
  const loading = porConfirmar.isPending || urgencias.isPending;
  const failed = porConfirmar.isError || urgencias.isError;

  const retry = () => {
    if (porConfirmar.isError) porConfirmar.refetch();
    if (urgencias.isError) urgencias.refetch();
  };

  let bar: ReactNode = null;
  if (nConfirmar > 0 || nUrgencias > 0 || failed) {
    bar = (
      <div className="av-bar" role="group" aria-label="Avisos de la agenda">
        {nConfirmar > 0 ? (
          <AvisoPill
            kind="confirmar"
            count={nConfirmar}
            icon="event_available"
            label="por confirmar mañana"
            onOpen={openSheet}
          />
        ) : null}
        {nUrgencias > 0 ? (
          <AvisoPill
            kind="urgencias"
            count={nUrgencias}
            icon="emergency"
            label="en lista de urgencias"
            onOpen={openSheet}
          />
        ) : null}
        {failed ? (
          <button type="button" className="av-pill av-pill--muted" onClick={retry}>
            <span className="av-pill__icon" aria-hidden>
              <Icon name="refresh" />
            </span>
            <span>No se pudieron cargar los avisos · Reintentar</span>
          </button>
        ) : null}
      </div>
    );
  } else if (!loading) {
    bar = (
      <p className="av-bar av-bar--empty" role="status">
        <span className="av-pill__icon" aria-hidden>
          <Icon name="task_alt" />
        </span>
        Sin pendientes
      </p>
    );
  }

  const isConfirmar = sheet.kind === 'confirmar';

  return (
    <>
      {bar}
      <Drawer.Root side={sheet.side} open={sheet.open} onOpenChange={handleOpenChange}>
        <Drawer.Content size="md" dividers className="av-sheet">
          <Drawer.Header>
            <Drawer.Title>{isConfirmar ? 'Por confirmar · mañana' : 'Lista de urgencias'}</Drawer.Title>
            <Drawer.Description>
              {isConfirmar
                ? `Citas del ${formatDiaCorto()}: llama para confirmar asistencia.`
                : 'Personas con prioridad alta que pueden ocupar un espacio si alguien cancela.'}
            </Drawer.Description>
            <Drawer.Close label="Cerrar" />
          </Drawer.Header>
          <Drawer.Body>
            {isConfirmar ? (
              <PorConfirmarList state={porConfirmar} onOpenCita={handleOpenCita} />
            ) : (
              <UrgenciasList state={urgencias} />
            )}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Root>
    </>
  );
}
