import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import type { ActividadPreventivaItem } from '@/domain/models/ActividadPreventiva';
import { DialogHeader } from '@/shared/ui/DialogHeader';
import { ActividadDetalle } from './ActividadDetalle';
import './actividades.css';

export type ActividadDialogState = { kind: 'detalle'; actividad: ActividadPreventivaItem };

export interface ActividadDialogProps {
  state: ActividadDialogState | null;
  onClose: () => void;
  /** Elemento desde el que hace morph el `Dialog` del kit (el botón o la tarjeta clicada). */
  anchor?: HTMLElement | null;
  ahora: Date;
  /** `actividad.registrar`: habilita las acciones de estado del detalle. */
  puedeRegistrar?: boolean;
}

/** Firma estable de la vista de entrada: los cambios locales se descartan solo cuando cambia (no por identidad). */
function firmaEstado(state: ActividadDialogState): string {
  return `detalle:${state.actividad.id}`;
}

/**
 * Diálogo único de Actividades: alta («Nueva actividad») y detalle, con la misma estructura que el de la Agenda
 * (`CitaDialog`): hace morph desde el elemento clicado, encabezado con cerrar + título + menú ⋮ y vistas que se
 * pintan al instante; lo pesado (selector de fecha, menú ⋮, catálogos) espera al morph (`useDialogSettled`).
 */
export function ActividadDialog({ state, onClose, anchor, ahora, puedeRegistrar = false }: ActividadDialogProps) {
  // El estado se conserva hasta que termina de cerrar: la animación de cierre aún muestra el contenido.
  const [held, setHeld] = useState<ActividadDialogState | null>(state);
  // Cambios locales (estado) tras una acción, para reflejarlos sin esperar al refetch de la lista.
  const [parche, setParche] = useState<{ sig: string; cambios: Partial<ActividadPreventivaItem> }>({ sig: '', cambios: {} });
  const [accionesSlot, setAccionesSlot] = useState<HTMLElement | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  if (state && state !== held) setHeld(state);
  const sig = state ? firmaEstado(state) : null;
  if (sig && sig !== parche.sig) setParche({ sig, cambios: {} });

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
    }
  }, []);

  const onPatch = useCallback((_actividadId: string, cambios: Partial<ActividadPreventivaItem>) => {
    setParche((prev) => ({ ...prev, cambios: { ...prev.cambios, ...cambios } }));
  }, []);

  const view = state ?? held;
  const actividad = view ? { ...view.actividad, ...parche.cambios } : null;
  // El título de la actividad ya está en la tarjeta del detalle: el encabezado solo dice «Actividad».

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
      <Dialog.Content size="lg" dividers className="vc-perf-dialog vc-dlg act-dialog">
        <DialogHeader
          title="Actividad"
          description={null}
          viewKey={view ? firmaEstado(view) : 'none'}
          actionsSlotRef={setAccionesSlot}
        />

        {actividad ? (
          <ActividadDetalle
            key={actividad.id}
            actividad={actividad}
            ahora={ahora}
            dir="none"
            puedeRegistrar={puedeRegistrar}
            onPatch={onPatch}
            accionesSlot={accionesSlot}
          />
        ) : null}
      </Dialog.Content>
    </Dialog.Root>
  );
}
