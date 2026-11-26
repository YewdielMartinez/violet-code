import { FuseButton, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/fuse-button';
import { Icon } from '@/shared/ui/Icon';
import { useArchiveFicha, useDeactivateFicha, type ExpedienteResumen } from '../api';

interface Props {
  expediente: ExpedienteResumen;
  onDone: () => void;
}

const ARCHIVE_LABELS = {
  primary: 'Archivar',
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

/**
 * Zona de gestión administrativa (sin borrado físico) al pie de la pestaña «Datos».
 * Solo se renderiza para roles con capacidad de gestión (`canManage`).
 */
export function FichaGestionAcciones({ expediente, onDone }: Props) {
  const archiveMutation = useArchiveFicha();
  const deactivateMutation = useDeactivateFicha();

  async function handleArchive() {
    try {
      await archiveMutation.mutateAsync(expediente.id);
      toast(`Expediente ${expediente.folio} archivado.`, { tone: 'success' });
      onDone();
    } catch {
      toast('No se pudo archivar el expediente.', { tone: 'error' });
    }
  }

  async function handleDeactivate() {
    try {
      await deactivateMutation.mutateAsync(expediente.id);
      toast(`Expediente ${expediente.folio} dado de baja lógicamente.`, { tone: 'success' });
      onDone();
    } catch {
      toast('No se pudo desactivar el expediente.', { tone: 'error' });
    }
  }

  return (
    <section
      aria-label="Zona de gestión"
      className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4"
    >
      <div className="flex items-start gap-2.5">
        <Icon name="admin_panel_settings" className="mt-0.5 text-on-surface-variant" />
        <div>
          <h4 className="text-sm font-medium text-on-surface">Zona de gestión</h4>
          <p className="text-xs text-on-surface-variant">
            Acciones sobre el ciclo del expediente sin eliminación física ni pérdida de bitácora.
          </p>
        </div>
      </div>

      <div className="grid gap-2.5">
        {expediente.estado !== 'archivado' ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-container-low p-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-on-surface">Archivar expediente</p>
              <p className="text-xs text-on-surface-variant">
                Cambia el estado a archivado para resguardo y consulta histórica.
              </p>
            </div>
            <FuseButton
              mode="split"
              tone="neutral"
              labels={ARCHIVE_LABELS}
              onConfirm={handleArchive}
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-container-low p-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-on-surface">Baja lógica</p>
            <p className="text-xs text-on-surface-variant">
              Retira el expediente del listado operativo conservando su historial y auditoría.
            </p>
          </div>
          <FuseButton
            mode="split"
            tone="danger"
            labels={DEACTIVATE_LABELS}
            onConfirm={handleDeactivate}
          />
        </div>
      </div>
    </section>
  );
}
