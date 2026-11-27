import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import { camposEditados } from '@/domain/models/ActividadEdicion';
import type { ActividadPreventivaItem } from '@/domain/models/ActividadPreventiva';
import { DialogHeader, type DialogDir } from '@/shared/ui/DialogHeader';
import { ActividadDescartarDialog } from './ActividadDescartarDialog';
import { ActividadDetalle } from './ActividadDetalle';
import { ActividadEditar } from './ActividadEditar';
import './actividades.css';

export type ActividadDialogState = { kind: 'detalle'; actividad: ActividadPreventivaItem };

export interface ActividadDialogProps {
  state: ActividadDialogState | null;
  onClose: () => void;
  /** Elemento desde el que hace morph el `Dialog` del kit (el botón o la tarjeta clicada). */
  anchor?: HTMLElement | null;
  ahora: Date;
  /** `actividad.registrar`: habilita las acciones de estado y la edición del detalle. */
  puedeRegistrar?: boolean;
}

/** Firma estable de la vista de entrada: los cambios locales se descartan solo cuando cambia (no por identidad). */
function firmaEstado(state: ActividadDialogState): string {
  return `detalle:${state.actividad.id}`;
}

type Vista = 'detalle' | 'editar';

interface Navegacion {
  vista: Vista;
  /** Dirección de la última transición (adelante al editar, atrás al volver al detalle). */
  dir: Exclude<DialogDir, 'none'>;
  /** `false` hasta la primera transición: la vista de entrada no se desliza (la apertura ya es el morph). */
  navegado: boolean;
}

const NAV_INICIAL: Navegacion = { vista: 'detalle', dir: 'forward', navegado: false };

/** Qué se quería hacer cuando se pidió confirmar el descarte de cambios. */
type Descarte = 'cerrar' | 'volver' | null;

/**
 * Diálogo único de Actividades: detalle y edición, con la misma estructura que el de la Agenda (`CitaDialog`): hace
 * morph desde el elemento clicado, encabezado con cerrar + título + menú ⋮ y vistas que se pintan al instante; lo
 * pesado (selector de fecha, menú ⋮, catálogos) espera al morph (`useDialogSettled`). «Editar» (menú ⋮ del detalle)
 * cambia por dentro a la vista de edición con el deslizamiento direccional de las demás vistas internas (que se
 * desactiva con `prefers-reduced-motion`) y botón de regreso; guardar o cancelar vuelve al detalle. Cerrar el
 * diálogo o volver con cambios sin guardar pide confirmación.
 */
export function ActividadDialog({ state, onClose, anchor, ahora, puedeRegistrar = false }: ActividadDialogProps) {
  // El estado se conserva hasta que termina de cerrar: la animación de cierre aún muestra el contenido.
  const [held, setHeld] = useState<ActividadDialogState | null>(state);
  // Cambios locales (estado, edición) tras una acción, para reflejarlos sin esperar al refetch de la lista.
  const [parche, setParche] = useState<{ sig: string; cambios: Partial<ActividadPreventivaItem> }>({ sig: '', cambios: {} });
  const [nav, setNav] = useState<Navegacion>(NAV_INICIAL);
  const [descarte, setDescarte] = useState<Descarte>(null);
  const [accionesSlot, setAccionesSlot] = useState<HTMLElement | null>(null);
  const stateRef = useRef(state);
  const sucioRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  if (state && state !== held) setHeld(state);
  const sig = state ? firmaEstado(state) : null;
  if (sig && sig !== parche.sig) {
    setParche({ sig, cambios: {} });
    setNav(NAV_INICIAL);
    setDescarte(null);
  }

  // Cerrar (X, Escape) con cambios sin guardar: el kit emite `mk:close` cancelable; se frena y se pide confirmación.
  useEffect(() => {
    function onCerrar(event: Event) {
      const target = event.target;
      if (!(target instanceof Element) || !target.classList.contains('act-dialog')) return;
      if (!sucioRef.current) return;
      event.preventDefault();
      setDescarte('cerrar');
    }
    document.addEventListener('mk:close', onCerrar);
    return () => document.removeEventListener('mk:close', onCerrar);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && stateRef.current) onClose();
    },
    [onClose],
  );

  const handleAfterClose = useCallback(() => {
    if (!stateRef.current) {
      setHeld(null);
      setParche({ sig: '', cambios: {} });
      setNav(NAV_INICIAL);
      setDescarte(null);
    }
  }, []);

  const onPatch = useCallback((_actividadId: string, cambios: Partial<ActividadPreventivaItem>) => {
    setParche((prev) => ({ ...prev, cambios: { ...prev.cambios, ...cambios } }));
  }, []);

  const onDirtyChange = useCallback((sucio: boolean) => {
    sucioRef.current = sucio;
  }, []);

  const irAEditar = useCallback(() => setNav({ vista: 'editar', dir: 'forward', navegado: true }), []);
  const volverADetalle = useCallback(() => {
    sucioRef.current = false;
    setNav({ vista: 'detalle', dir: 'back', navegado: true });
  }, []);

  /** Cancelar / flecha de regreso: con cambios sin guardar pide confirmación antes de volver. */
  const pedirVolver = useCallback(() => {
    if (sucioRef.current) setDescarte('volver');
    else volverADetalle();
  }, [volverADetalle]);

  const onGuardada = useCallback(
    (actualizada: ActividadPreventivaItem) => {
      setParche((prev) => ({ ...prev, cambios: { ...prev.cambios, ...camposEditados(actualizada) } }));
      volverADetalle();
    },
    [volverADetalle],
  );

  function confirmarDescarte() {
    const que = descarte;
    setDescarte(null);
    sucioRef.current = false;
    if (que === 'cerrar') onClose();
    else volverADetalle();
  }

  const view = state ?? held;
  const actividad = view ? { ...view.actividad, ...parche.cambios } : null;
  const editando = nav.vista === 'editar' && puedeRegistrar && actividad?.estado === 'pendiente';
  const dir: DialogDir = nav.navegado ? nav.dir : 'none';
  // El título de la actividad ya está en la tarjeta del detalle: el encabezado solo dice «Actividad».

  return (
    <>
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
        <Dialog.Content size="lg" dividers className="vc-perf-dialog vc-dlg act-dialog">
          <DialogHeader
            title={editando ? 'Editar actividad' : 'Actividad'}
            description={null}
            viewKey={view ? `${firmaEstado(view)}:${editando ? 'editar' : 'detalle'}` : 'none'}
            dir={dir}
            onBack={editando ? pedirVolver : undefined}
            actionsSlotRef={setAccionesSlot}
          />

          {actividad ? (
            editando ? (
              <ActividadEditar
                key={`editar:${actividad.id}`}
                actividad={actividad}
                dir={dir}
                onCancel={pedirVolver}
                onSaved={onGuardada}
                onDirtyChange={onDirtyChange}
              />
            ) : (
              <ActividadDetalle
                key={actividad.id}
                actividad={actividad}
                ahora={ahora}
                dir={dir}
                puedeRegistrar={puedeRegistrar}
                onPatch={onPatch}
                accionesSlot={accionesSlot}
                onEditar={irAEditar}
              />
            )
          ) : null}
        </Dialog.Content>
      </Dialog.Root>

      <ActividadDescartarDialog open={descarte !== null} onKeepEditing={() => setDescarte(null)} onDiscard={confirmarDescarte} />
    </>
  );
}
