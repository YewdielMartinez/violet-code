import { toast } from '@yewdiel21/motion-kit/react';
import { ESTADO_FICHA_LABELS, useReopenFicha, type ExpedienteResumen } from '../api';

/**
 * Lógica de desarchivado (reapertura) de un expediente: RPC `reabrir_ficha` + toasts.
 * Devuelve `true` si la reapertura fue exitosa.
 */
export function useReopenExpediente() {
  const reopenMutation = useReopenFicha();

  async function reopen(
    expediente: Pick<ExpedienteResumen, 'id' | 'folio'>,
    motivo: string,
  ): Promise<boolean> {
    try {
      const estado = await reopenMutation.mutateAsync({ fichaId: expediente.id, motivo });
      toast(
        `Expediente ${expediente.folio} desarchivado (${ESTADO_FICHA_LABELS[estado]}).`,
        { tone: 'success' },
      );
      return true;
    } catch (err) {
      const msg =
        typeof err === 'object' &&
        err !== null &&
        'message' in err &&
        typeof (err as { message: unknown }).message === 'string' &&
        (err as { message: string }).message
          ? (err as { message: string }).message
          : 'No se pudo desarchivar el expediente.';
      toast(msg, { tone: 'error' });
      return false;
    }
  }

  return { reopen, isReopening: reopenMutation.isPending };
}
