import { useState } from 'react';
import { Dialog, FuseButton } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import '@yewdiel21/motion-kit/css/components/fuse-button';
import type { DocumentoAdjunto } from '../documentosApi';

const ARCHIVE_FUSE_LABELS = {
  primary: 'Archivar',
  secondary: 'Cancelar',
  loading: 'Archivando…',
  success: 'Archivado',
  error: 'Error',
};

interface ArchivarDocumentoDialogProps {
  documento: DocumentoAdjunto | null;
  onClose: () => void;
  onConfirmArchive: (doc: DocumentoAdjunto) => Promise<void>;
}

export function ArchivarDocumentoDialog({
  documento,
  onClose,
  onConfirmArchive,
}: ArchivarDocumentoDialogProps) {
  const [archiving, setArchiving] = useState(false);

  function handleOpenChange(open: boolean) {
    if (!open && !archiving) {
      onClose();
    }
  }

  return (
    <Dialog.Root
      open={Boolean(documento)}
      onOpenChange={handleOpenChange}
      closeOnBackdrop={!archiving}
    >
      <Dialog.Content size="sm">
        <Dialog.Header>
          <Dialog.Title>Archivar documento</Dialog.Title>
          <Dialog.Close label="Cerrar" disabled={archiving} />
        </Dialog.Header>

        <Dialog.Body>
          {documento ? (
            <div className="grid gap-2 text-sm text-on-surface-variant">
              <p>
                ¿Archivar{' '}
                <strong className="font-medium text-on-surface">{documento.nombreArchivo}</strong>{' '}
                ({documento.tipoDocumentoNombre})?
              </p>
              <p className="text-xs">
                Dejará de mostrarse en el expediente, pero permanecerá resguardado para auditoría sin
                borrado físico.
              </p>
            </div>
          ) : null}
        </Dialog.Body>

        <Dialog.Footer>
          {documento ? (
            <FuseButton
              key={documento.id}
              mode="fuse"
              tone="danger"
              align="end"
              height={40}
              labels={ARCHIVE_FUSE_LABELS}
              onStateChange={(state) => setArchiving(state === 'loading')}
              onCancel={() => {
                if (!archiving) onClose();
              }}
              onConfirm={async () => {
                await onConfirmArchive(documento);
              }}
            />
          ) : null}
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
