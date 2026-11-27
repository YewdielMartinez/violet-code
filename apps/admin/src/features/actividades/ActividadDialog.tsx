import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import type { ActividadPreventivaItem } from '@/domain/models/ActividadPreventiva';
import { ActividadCrearForm } from './ActividadCrearForm';
import { ActividadDetalle } from './ActividadDetalle';
import { fechaLargaActividad, horaActividad } from './actividadesList';
import './actividades.css';

export type ActividadDialogState = { kind: 'crear' } | { kind: 'detalle'; actividad: ActividadPreventivaItem };

export interface ActividadDialogProps {
  state: ActividadDialogState | null;
  onClose: () => void;
  /** Elemento desde el que hace morph el `Dialog` del kit (el botón o la tarjeta clicada). */
  anchor?: HTMLElement | null;
  ahora: Date;
}

/**
 * Diálogo único de Actividades: alta («Nueva actividad») y detalle. Hace morph desde el elemento clicado; lo pesado
 * del formulario (selector de fecha, catálogos) espera al morph dentro de `ActividadCrearForm` (`useDialogSettled`).
 */
export function ActividadDialog({ state, onClose, anchor, ahora }: ActividadDialogProps) {
  // El estado se conserva hasta que termina de cerrar: la animación de cierre aún muestra el contenido.
  const [held, setHeld] = useState<ActividadDialogState | null>(state);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  if (state && state !== held) setHeld(state);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && stateRef.current) onClose();
    },
    [onClose],
  );

  const handleAfterClose = useCallback(() => {
    if (!stateRef.current) setHeld(null);
  }, []);

  const view = state ?? held;
  const titulo = view?.kind === 'crear' ? 'Nueva actividad' : (view?.actividad.titulo ?? 'Actividad');
  const descripcion =
    view?.kind === 'crear'
      ? 'Programa o registra una capacitación, taller o jornada en una escuela, empresa o comunidad.'
      : view
        ? `${fechaLargaActividad(view.actividad.programadaEn)} · ${horaActividad(view.actividad.programadaEn)}`
        : null;

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
      <Dialog.Content size="lg" dividers className="vc-perf-dialog act-dialog">
        <Dialog.Header className="act-dialog__header">
          <Dialog.Close label="Cerrar" />
          <div className="act-dialog__title">
            <Dialog.Title className="truncate">{titulo}</Dialog.Title>
            {descripcion ? <Dialog.Description className="truncate">{descripcion}</Dialog.Description> : null}
          </div>
        </Dialog.Header>

        {view?.kind === 'crear' ? <ActividadCrearForm onCancel={onClose} onCreated={onClose} /> : null}
        {view?.kind === 'detalle' ? <ActividadDetalle actividad={view.actividad} ahora={ahora} onClose={onClose} /> : null}
      </Dialog.Content>
    </Dialog.Root>
  );
}
