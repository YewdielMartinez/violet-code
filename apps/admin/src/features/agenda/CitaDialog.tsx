import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Dialog } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import type { AgendaItem } from '@/domain/models/Cita';
import { useAuth } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';
import { puedeCrearCita } from './agendaPermisos';
import { CitaCrearForm } from './CitaCrearForm';
import { CitaDetalle } from './CitaDetalle';
import { CitaDiaList } from './CitaDiaList';
import { CitaSeguimientoView } from './CitaSeguimientoView';
import { fechaInicialCita, firmaEstado, tituloDia, type CitaDir, type CitaView } from './citaDialogUtils';
import './cita-dialog.css';

export type CitaDialogState =
  /** Recuadro de día con citas: lista del día + botón "Nueva cita". */
  | { kind: 'dia'; fecha: Date; citas: AgendaItem[] }
  /** Recuadro/slot vacío o botón "Nueva cita": formulario de alta precargado con la fecha. */
  | { kind: 'crear'; fecha: Date; areaId?: number | null }
  /** Cita concreta: detalle, estado, asistencia + hoja de seguimiento, cancelar/reagendar. */
  | { kind: 'detalle'; cita: AgendaItem };

export interface CitaDialogProps {
  state: CitaDialogState | null;
  onClose: () => void;
  /** Elemento desde el que hace morph el Dialog del kit (el recuadro clicado). */
  anchor?: HTMLElement | null;
}

interface Navegacion {
  /** Firma del estado de entrada: al cambiar, la navegación interna vuelve a empezar. */
  sig: string;
  /** Vistas apiladas sobre la de entrada (detalle de una cita del día, formulario, hoja…). */
  stack: CitaView[];
  dir: Exclude<CitaDir, 'none'>;
  /** `false` hasta la primera navegación interna: la vista de entrada no se desliza (la apertura ya es el morph). */
  navegado: boolean;
  /** Cambios locales (estado) tras una acción, para reflejarlos sin esperar al refetch de la agenda. */
  parches: Record<string, Partial<AgendaItem>>;
}

const NAV_VACIA: Navegacion = { sig: '', stack: [], dir: 'forward', navegado: false, parches: {} };

function tituloVista(view: CitaView): string {
  switch (view.kind) {
    case 'dia':
      return tituloDia(view.fecha);
    case 'crear':
      return 'Nueva cita';
    case 'detalle':
      return 'Cita';
    case 'seguimiento':
      return 'Hoja de seguimiento';
  }
}

function descripcionVista(view: CitaView, citas: readonly AgendaItem[]): string | null {
  switch (view.kind) {
    case 'dia':
      return citas.length === 1 ? '1 cita' : `${citas.length} citas`;
    case 'crear':
      return tituloDia(view.fecha);
    case 'detalle':
      // El nombre ya está en la tarjeta «Paciente» del detalle: el encabezado solo dice «Cita».
      return null;
    case 'seguimiento':
      return view.cita.nombreCompleto;
  }
}

function claveVista(view: CitaView, profundidad: number): string {
  const id = view.kind === 'detalle' || view.kind === 'seguimiento' ? view.cita.citaId : view.fecha.getTime();
  return `${profundidad}:${view.kind}:${id}`;
}

/**
 * Diálogo único de la Agenda (`RF-06`, `RF-07`): un `Dialog` del kit que hace morph desde el recuadro clicado y
 * cambia de vista por dentro (día → detalle → hoja / reagendar, o día → nueva cita) con un deslizamiento
 * direccional y botón de regreso. Las vistas «día» y «detalle» se pintan al instante (sin esqueleto); solo lo pesado
 * (selector de fecha, menú ⋮, hoja de seguimiento) espera al morph (`useDialogSettled`).
 */
export function CitaDialog({ state, onClose, anchor }: CitaDialogProps) {
  const { user } = useAuth();
  const [held, setHeld] = useState<CitaDialogState | null>(state);
  const [nav, setNav] = useState<Navegacion>(NAV_VACIA);
  const stateRef = useRef(state);
  const [accionesSlot, setAccionesSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // El estado de entrada se conserva hasta que termina de cerrar (la animación de cierre aún muestra el contenido).
  if (state && state !== held) setHeld(state);
  const sig = state ? firmaEstado(state) : null;
  if (sig && sig !== nav.sig) setNav({ ...NAV_VACIA, sig });

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && stateRef.current) onClose();
    },
    [onClose],
  );

  const handleAfterClose = useCallback(() => {
    if (stateRef.current) return;
    setHeld(null);
    setNav(NAV_VACIA);
  }, []);

  const push = useCallback((view: CitaView) => {
    setNav((n) => ({ ...n, stack: [...n.stack, view], dir: 'forward', navegado: true }));
  }, []);

  const pop = useCallback(() => {
    setNav((n) => ({ ...n, stack: n.stack.slice(0, -1), dir: 'back', navegado: true }));
  }, []);

  const parchar = useCallback((citaId: string, patch: Partial<AgendaItem>) => {
    setNav((n) => ({ ...n, parches: { ...n.parches, [citaId]: { ...n.parches[citaId], ...patch } } }));
  }, []);

  const conParche = (cita: AgendaItem): AgendaItem => ({ ...cita, ...nav.parches[cita.citaId] });

  const view: CitaView | null = nav.stack[nav.stack.length - 1] ?? held;
  const citasDia = view?.kind === 'dia' ? view.citas.map(conParche) : [];
  // Solo Recepción y Jurídico agendan (regla única en `agendaPermisos`).
  const puedeAgendar = puedeCrearCita(user?.role);
  const puedeVolver = nav.stack.length > 0;
  const dir: CitaDir = nav.navegado ? nav.dir : 'none';

  function renderVista(current: CitaView) {
    switch (current.kind) {
      case 'dia':
        return (
          <CitaDiaList
            citas={citasDia}
            dir={dir}
            puedeAgendar={puedeAgendar}
            onOpenCita={(cita) => push({ kind: 'detalle', cita })}
            onNueva={() => push({ kind: 'crear', fecha: current.fecha })}
          />
        );
      case 'crear':
        return (
          <CitaCrearForm
            fecha={current.fecha}
            areaId={current.areaId}
            persona={current.persona}
            dir={dir}
            onCancel={puedeVolver ? pop : onClose}
            onCreated={onClose}
          />
        );
      case 'detalle':
        return (
          <CitaDetalle
            cita={conParche(current.cita)}
            dir={dir}
            onPatch={parchar}
            onAbrirSeguimiento={(cita) => push({ kind: 'seguimiento', cita })}
            onAgendarSiguiente={(cita) =>
              push({
                kind: 'crear',
                fecha: fechaInicialCita(new Date(Date.now() + 24 * 60 * 60 * 1000)),
                areaId: cita.areaId,
                persona: { id: cita.personaId, nombre: cita.nombreCompleto },
              })
            }
            onAbrirCita={(cita) => push({ kind: 'detalle', cita })}
            onClose={onClose}
            accionesSlot={accionesSlot}
          />
        );
      case 'seguimiento':
        return (
          <CitaSeguimientoView
            cita={conParche(current.cita)}
            dir={dir}
            onDone={(asistencia) => {
              const citaId = current.cita.citaId;
              setNav((n) => ({
                ...n,
                stack: n.stack.slice(0, -1),
                dir: 'back',
                navegado: true,
                parches: { ...n.parches, [citaId]: { ...n.parches[citaId], estado: asistencia } },
              }));
            }}
          />
        );
    }
  }

  const descripcion = view ? descripcionVista(view, citasDia) : null;

  return (
    <Dialog.Root
      open={state !== null}
      anchor={anchor}
      onOpenChange={handleOpenChange}
      onAfterClose={handleAfterClose}
      closeOnBackdrop={false}
      animateContent={false}
      drag={false}
      autoResize={false}
    >
      <Dialog.Content size="lg" dividers className="vc-perf-dialog vc-cita-dialog">
        <Dialog.Header className="vc-cita-header">
          <Dialog.Close label="Cerrar" />
          {puedeVolver ? (
            <button type="button" aria-label="Volver" onClick={pop} className="vc-cita-back vc-cita-btn">
              <Icon name="arrow_back" />
            </button>
          ) : null}
          <div key={view ? `${nav.stack.length}:${view.kind}` : 'none'} className="vc-cita-title" data-dir={dir}>
            <Dialog.Title className="truncate">{view ? tituloVista(view) : 'Cita'}</Dialog.Title>
            {descripcion ? <Dialog.Description className="truncate">{descripcion}</Dialog.Description> : null}
          </div>
          {view?.kind === 'detalle' ? <div ref={setAccionesSlot} className="vc-cita-header-slot" /> : null}
        </Dialog.Header>

        {view ? <Fragment key={claveVista(view, nav.stack.length)}>{renderVista(view)}</Fragment> : null}
      </Dialog.Content>
    </Dialog.Root>
  );
}
