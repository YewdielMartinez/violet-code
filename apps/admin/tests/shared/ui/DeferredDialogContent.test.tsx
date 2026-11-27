import { render, screen, waitFor } from '@testing-library/react';
import { Dialog } from '@yewdiel21/motion-kit/react';
import { describe, expect, it } from 'vitest';
import { DeferredDialogContent, DialogFormSkeleton } from '@/shared/ui/DeferredDialogContent';

function Harness({ active }: { active: boolean }) {
  return (
    <Dialog.Root open={active}>
      <Dialog.Content>
        <DeferredDialogContent active={active} fallback={<DialogFormSkeleton blocks={[2, 3]} />}>
          <Dialog.Body>
            <input aria-label="campo" />
          </Dialog.Body>
        </DeferredDialogContent>
      </Dialog.Content>
    </Dialog.Root>
  );
}

describe('DeferredDialogContent', () => {
  it('no monta nada mientras el diálogo está inactivo', () => {
    render(<Harness active={false} />);
    expect(screen.queryByLabelText('campo')).toBeNull();
    expect(screen.queryByRole('status', { hidden: true })).toBeNull();
  });

  it('muestra el marcador al activarse y monta el contenido en cuanto termina el morph', async () => {
    const { rerender } = render(<Harness active={false} />);
    rerender(<Harness active />);

    expect(screen.getByRole('status', { hidden: true }).getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByLabelText('campo')).toBeNull();

    await waitFor(() => expect(screen.getByLabelText('campo', { selector: 'input' })).toBeTruthy());
    expect(screen.queryByRole('status', { hidden: true })).toBeNull();
  });
});
