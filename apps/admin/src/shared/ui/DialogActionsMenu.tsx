import { createPortal } from 'react-dom';
import { Menu } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/menu';
import { useDialogSettled } from '@/shared/hooks/useDialogSettled';
import { Icon } from './Icon';
import './vc-ui.css';

/** El menú crea su `<dialog>` imperativamente: se monta a ~60 % del morph; antes, un botón idéntico y quieto. */
const MENU_MAX_WAIT_MS = 420;

export interface DialogMenuItem {
  value: string;
  label: string;
  icon: string;
}

export interface DialogActionsMenuProps {
  /** Hueco del encabezado (`DialogHeader` → `actionsSlotRef`) donde se monta el botón ⋮. */
  slot: HTMLElement | null | undefined;
  items: readonly DialogMenuItem[];
  disabled?: boolean;
  onSelect: (value: string) => void;
  label?: string;
}

/** Menú ⋮ del encabezado con las acciones secundarias de la vista; no pinta nada si no hay acciones. */
export function DialogActionsMenu({ slot, items, disabled = false, onSelect, label = 'Más acciones' }: DialogActionsMenuProps) {
  const listo = useDialogSettled(MENU_MAX_WAIT_MS);
  if (!slot || items.length === 0) return null;

  return createPortal(
    listo ? (
      <Menu.Root placement="bottom-end" onSelect={onSelect}>
        <Menu.Trigger className="vc-iconbtn" aria-label={label} disabled={disabled}>
          <Icon name="more_vert" />
        </Menu.Trigger>
        <Menu.Content className="vc-dlg-menu">
          {items.map((item) => (
            <Menu.Item key={item.value} value={item.value}>
              <Icon name={item.icon} />
              {item.label}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Root>
    ) : (
      <span aria-hidden className="vc-iconbtn">
        <Icon name="more_vert" />
      </span>
    ),
    slot,
  );
}
