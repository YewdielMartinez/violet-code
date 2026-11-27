import { toast } from '@yewdiel21/motion-kit/react';
import { useArchiveFicha, type ExpedienteResumen } from '../api';
import { traducirErrorCicloExpediente } from './traducirErrorCiclo';

/**
 * Lógica única de archivado de un expediente: RPC `archivar_ficha` con motivo obligatorio + toasts.
 * La reutilizan la zona de gestión del detalle y el menú de acciones del listado.
 * Devuelve `true` si el archivado fue exitoso.
 */
export function useArchiveExpediente() {
  const archiveMutation = useArchiveFicha();

  async function archive(
    expediente: Pick<ExpedienteResumen, 'id' | 'folio'>,
    motivo: string,
  ): Promise<boolean> {
    try {
      await archiveMutation.mutateAsync({ fichaId: expediente.id, motivo });
      toast(`Expediente ${expediente.folio} archivado.`, { tone: 'success' });
      return true;
    } catch (err) {
      toast(traducirErrorCicloExpediente(err, 'archivar'), { tone: 'error' });
      return false;
    }
  }

  return { archive, isArchiving: archiveMutation.isPending };
}
