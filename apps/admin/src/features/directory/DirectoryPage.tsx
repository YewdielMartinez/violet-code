import { DataTable, EmptyState } from '@yewdiel21/motion-kit/react';
import type { DataTableProps } from '@yewdiel21/motion-kit/react';
// data-table compone menús, filtros, selects y paginación del kit: se cargan sus estilos aquí.
import '@yewdiel21/motion-kit/css/components/data-table';
import '@yewdiel21/motion-kit/css/components/filter-builder';
import '@yewdiel21/motion-kit/css/components/menu';
import '@yewdiel21/motion-kit/css/components/select';
import '@yewdiel21/motion-kit/css/components/pagination';
import '@yewdiel21/motion-kit/css/components/empty-state';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useDirectory, type DirectoryEntry } from './api';

type Row = DirectoryEntry & Record<string, unknown>;

// Configuración estática fuera del componente: la tabla no recibe un arreglo nuevo en cada render.
const COLUMNS: DataTableProps<Row>['columns'] = [
  { key: 'name', label: 'Nombre', sortable: true, searchable: true },
  {
    key: 'kind',
    label: 'Tipo',
    type: 'select',
    filterable: true,
    options: [
      { value: 'Institution', label: 'Instancia' },
      { value: 'VioletPoint', label: 'Punto Violeta' },
    ],
  },
  { key: 'phone', label: 'Teléfono' },
  { key: 'schedule', label: 'Horario' },
  { key: 'address', label: 'Dirección', hidden: true },
];
const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];

export default function DirectoryPage() {
  const { data, isError, refetch } = useDirectory();

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
            actions={RETRY_ACTION}
            onAction={() => refetch()}
          />
        </div>
      ) : data ? (
        <DataTable<Row> caption="Directorio" rows={data as Row[]} columns={COLUMNS} pageSize={10} />
      ) : (
        <div className="h-64 animate-pulse rounded-3xl bg-surface-container" />
      )}
    </>
  );
}
