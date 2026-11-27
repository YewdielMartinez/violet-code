import { toast } from '@yewdiel21/motion-kit/react';
import { useArchiveFicha, type ExpedienteResumen } from '../api';

/**
 * Lógica única de archivado de un expediente (llamada al repositorio + toasts).
 * La reutilizan la zona de gestión del detalle y el menú de acciones del listado.
 * Devuelve `true` si el archivado fue exitoso.
 */
export function useArchiveExpediente() {
  const archiveMutation = useArchiveFicha();

  async function archive(expediente: Pick<ExpedienteResumen, 'id' | 'folio'>): Promise<boolean> {
    try {
      await archiveMutation.mutateAsync(expediente.id);
      toast(`Expediente ${expediente.folio} archivado.`, { tone: 'success' });
      return true;
    } catch {
      toast('No se pudo archivar el expediente.', { tone: 'error' });
      return false;
    }
  }

  return { archive, isArchiving: archiveMutation.isPending };
}
