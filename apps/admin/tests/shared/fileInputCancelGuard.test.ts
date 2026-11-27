import { afterEach, describe, expect, it, vi } from 'vitest';
import { installFileInputCancelGuard } from '@/shared/dom/fileInputCancelGuard';

describe('installFileInputCancelGuard', () => {
  let uninstall: (() => void) | null = null;

  afterEach(() => {
    uninstall?.();
    uninstall = null;
    document.body.innerHTML = '';
  });

  function setup() {
    const dialog = document.createElement('dialog');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    dialog.appendChild(fileInput);
    document.body.appendChild(dialog);
    const onDialogCancel = vi.fn();
    dialog.addEventListener('cancel', onDialogCancel);
    uninstall = installFileInputCancelGuard();
    return { dialog, fileInput, onDialogCancel };
  }

  it('evita que el cancel del selector de archivos llegue al <dialog>', () => {
    const { fileInput, onDialogCancel } = setup();
    fileInput.dispatchEvent(new Event('cancel', { bubbles: true }));
    expect(onDialogCancel).not.toHaveBeenCalled();
  });

  it('deja pasar el cancel propio del <dialog> (tecla Escape)', () => {
    const { dialog, onDialogCancel } = setup();
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(onDialogCancel).toHaveBeenCalledTimes(1);
  });
});
