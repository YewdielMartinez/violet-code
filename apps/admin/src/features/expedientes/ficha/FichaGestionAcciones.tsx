import { FuseButton, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/fuse-button';
import { useArchiveFicha, useDeactivateFicha, type ExpedienteResumen } from '../api';

interface Props {
  expediente: ExpedienteResumen;
  onDone: () => void;
}

const ARCHIVE_LABELS = {
  primary: 'Archivar expediente',
  confirm: 'Sí, archivar',
  cancel: 'Cancelar',
  done: 'Archivado',
};

const DEACTIVATE_LABELS = {
  primary: 'Baja lógica',
  confirm: 'Sí, desactivar',
  cancel: 'Cancelar',
  done: 'Desactivado',
};

/** Archivar o dar de baja lógica el expediente (sin borrado físico). Solo Trabajo Social y Dirección. */
export function FichaGestionAcciones({ expediente, onDone }: Props) {
  const archiveMutation = useArchiveFicha();
  const deactivateMutation = useDeactivateFicha();

  async function handleArchive() {
    try {
      await archiveMutation.mutateAsync(expediente.id);
      toast(`Expediente ${expediente.folio} archivado.`);
      onDone();
    } catch {
      toast('No se pudo archivar el expediente.', { tone: 'error' });
    }
  }

  async function handleDeactivate() {
    try {
      await deactivateMutation.mutateAsync(expediente.id);
      toast(`Expediente ${expediente.folio} dado de baja lógicamente.`);
      onDone();
    } catch {
      toast('No se pudo desactivar el expediente.', { tone: 'error' });
    }
  }

  return (
    <div className="mr-auto flex flex-wrap items-center gap-2">
      {expediente.estado !== 'archivado' ? (
        <FuseButton mode="split" labels={ARCHIVE_LABELS} onConfirm={handleArchive} />
      ) : null}
      <FuseButton mode="split" labels={DEACTIVATE_LABELS} onConfirm={handleDeactivate} />
    </div>
  );
}
