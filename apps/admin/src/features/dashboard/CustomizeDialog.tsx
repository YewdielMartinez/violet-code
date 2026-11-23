import { Dialog } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import type { StaffRole } from '@/shared/auth/session';
import { availableWidgets, setVisibleWidgets, WIDGETS, type WidgetId } from './layout';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  role: StaffRole;
  visible: WidgetId[];
}

/** Mostrar u ocultar widgets del dashboard. Se guarda por persona en este navegador. */
export function CustomizeDialog({ open, onOpenChange, userId, role, visible }: Props) {
  const options = availableWidgets(role);

  function toggle(id: WidgetId, on: boolean) {
    // Conserva el orden del catálogo.
    const next = WIDGETS.map((w) => w.id).filter((w) => (w === id ? on : visible.includes(w)));
    setVisibleWidgets(userId, next);
  }

  function reset() {
    setVisibleWidgets(
      userId,
      WIDGETS.filter((w) => w.defaultFor.includes(role) && options.includes(w)).map((w) => w.id),
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="sm">
        <Dialog.Header>
          <Dialog.Title>Personalizar dashboard</Dialog.Title>
          <Dialog.Close label="Cerrar" />
        </Dialog.Header>
        <Dialog.Body>
          <ul className="grid gap-1">
            {options.map((w) => (
              <li key={w.id}>
                <label className="flex cursor-pointer items-center gap-4 rounded-2xl px-3 py-3 hover:bg-surface-container-low">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-on-surface">{w.title}</span>
                    <span className="block text-sm text-on-surface-variant">{w.description}</span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    className="mk-switch"
                    checked={visible.includes(w.id)}
                    onChange={(e) => toggle(w.id, e.target.checked)}
                  />
                </label>
              </li>
            ))}
          </ul>
        </Dialog.Body>
        <Dialog.Footer>
          <button type="button" className="mk-button mk-button--text" onClick={reset}>
            Restablecer según mi rol
          </button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
