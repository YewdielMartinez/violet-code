import { DataTable, EmptyState } from '@yewdiel21/motion-kit/react';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useDirectory, type DirectoryEntry } from './api';

const KIND_OPTIONS = [
  { value: 'Institution', label: 'Instancia' },
  { value: 'VioletPoint', label: 'Punto Violeta' },
];

export function DirectoryPage() {
  const { data, isLoading, isError, refetch } = useDirectory();

  return (
    <>
      <PageHeader
        title="Directorio y Puntos Violeta"
        description="Lo que la app móvil descarga para usar sin conexión. Datos sintéticos."
      />

      {isError ? (
        <div className="rounded-3xl bg-surface-container-low p-10">
          <EmptyState
            illustration="error"
            title="No se pudo cargar el directorio"
            description="Verifica que Violet Code Core esté en ejecución."
            actions={[{ id: 'retry', label: 'Reintentar' }]}
            onAction={() => refetch()}
          />
        </div>
      ) : isLoading ? (
        <div className="h-64 animate-pulse rounded-3xl bg-surface-container" />
      ) : (
        <DataTable<DirectoryEntry & Record<string, unknown>>
          caption="Directorio"
          rows={(data ?? []) as Array<DirectoryEntry & Record<string, unknown>>}
          columns={[
            { key: 'name', label: 'Nombre', sortable: true, searchable: true },
            { key: 'kind', label: 'Tipo', type: 'select', options: KIND_OPTIONS, filterable: true },
            { key: 'phone', label: 'Teléfono' },
            { key: 'schedule', label: 'Horario' },
            { key: 'address', label: 'Dirección', hidden: true },
          ]}
          pageSize={10}
        />
      )}
    </>
  );
}
