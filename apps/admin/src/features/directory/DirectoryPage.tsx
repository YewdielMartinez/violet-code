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
import { CATEGORIA_LABELS, useDirectory, type DirectorioInstitucion } from './api';

type Row = DirectorioInstitucion & Record<string, unknown>;

const CATEGORIA_OPTIONS = Object.entries(CATEGORIA_LABELS).map(([value, label]) => ({ value, label }));

// Configuración estática fuera del componente: la tabla no recibe un arreglo nuevo en cada render.
const COLUMNS: DataTableProps<Row>['columns'] = [
  { key: 'nombre', label: 'Nombre', sortable: true, searchable: true },
  {
    key: 'categoria',
    label: 'Categoría',
    type: 'select',
    filterable: true,
    options: CATEGORIA_OPTIONS,
  },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'horario', label: 'Horario' },
  { key: 'direccion', label: 'Dirección', hidden: true },
];
const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];

export default function DirectoryPage() {
  const { data, isError, refetch } = useDirectory();

  return (
    <>
      <PageHeader
        title="Directorio y Puntos Violeta"
        description="Instancias de atención y redes de apoyo desde Supabase (sin dirección pública en refugios)."
      />

      {isError ? (
        <div className="rounded-3xl bg-surface-container-low p-10">
          <EmptyState
            illustration="error"
            title="No se pudo cargar el directorio"
            description="Verifica tu conexión y configuración de Supabase."
            actions={RETRY_ACTION}
            onAction={() => refetch()}
          />
        </div>
      ) : data ? (
        <DataTable<Row> caption="Directorio institucional" rows={data as Row[]} columns={COLUMNS} pageSize={10} />
      ) : (
        <div className="h-64 animate-pulse rounded-3xl bg-surface-container" />
      )}
    </>
  );
}
