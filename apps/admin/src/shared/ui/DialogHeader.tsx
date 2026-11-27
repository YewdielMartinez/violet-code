import { Dialog } from '@yewdiel21/motion-kit/react';
import { Icon } from './Icon';
import './vc-ui.css';

/** Dirección de la última navegación interna del diálogo (`none`: vista de entrada, sin deslizar). */
export type DialogDir = 'none' | 'forward' | 'back';

export interface DialogHeaderProps {
  title: string;
  description?: string | null;
  /** Cambia con cada vista: vuelve a montar el título y repite su entrada. */
  viewKey: string;
  dir?: DialogDir;
  /** Con valor, muestra el botón de regreso junto al de cerrar. */
  onBack?: () => void;
  /** Ref callback del hueco a la derecha del título (monta ahí el menú ⋮ con `DialogActionsMenu`). */
  actionsSlotRef?: ((element: HTMLElement | null) => void) | null;
}

/**
 * Encabezado de los diálogos: cerrar (X) a la izquierda, regreso opcional, título + descripción y, a la derecha,
 * un hueco para el menú ⋮ de acciones secundarias. Va dentro de `<Dialog.Content className="vc-dlg …">`.
 */
export function DialogHeader({ title, description, viewKey, dir = 'none', onBack, actionsSlotRef }: DialogHeaderProps) {
  return (
    <Dialog.Header>
      <Dialog.Close label="Cerrar" />
      {onBack ? (
        <button type="button" aria-label="Volver" onClick={onBack} className="vc-dlg-back vc-press">
          <Icon name="arrow_back" />
        </button>
      ) : null}
      <div key={viewKey} className="vc-dlg-title" data-dir={dir}>
        <Dialog.Title className="truncate">{title}</Dialog.Title>
        {description ? <Dialog.Description className="truncate">{description}</Dialog.Description> : null}
      </div>
      {actionsSlotRef ? <div ref={actionsSlotRef} className="vc-dlg-slot" /> : null}
    </Dialog.Header>
  );
}
