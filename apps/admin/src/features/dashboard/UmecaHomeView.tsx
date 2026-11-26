import { useQuery } from '@tanstack/react-query';
import { DataTable, EmptyState } from '@yewdiel21/motion-kit/react';
import type { DataTableProps } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/data-table';
import '@yewdiel21/motion-kit/css/components/filter-builder';
import '@yewdiel21/motion-kit/css/components/menu';
import '@yewdiel21/motion-kit/css/components/select';
import '@yewdiel21/motion-kit/css/components/pagination';
import '@yewdiel21/motion-kit/css/components/empty-state';
import { fetchUmecaCitas, type UmecaCita } from '@/shared/auth/session';
import { PageHeader } from '@/shared/ui/PageHeader';
import { dayAndTime } from './widgets/format';

type UmecaRow = {
  id: string;
  persona: string;
  fechaHora: string;
  estado: string;
} & Record<string, unknown>;

const ESTADO_LABELS: Record<string, string> = {
  agendada: 'Agendada',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  reagendada: 'Reagendada',
  asistio: 'Asistió',
  no_asistio: 'No asistió',
};

const COLUMNS: DataTableProps<UmecaRow>['columns'] = [
  { key: 'persona', label: 'Persona canalizada', sortable: true, searchable: true },
  { key: 'fechaHora', label: 'Fecha y hora', sortable: true },
  { key: 'estado', label: 'Estado', sortable: true },
];

const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];

function toUmecaRow(c: UmecaCita): UmecaRow {
  const persona = [c.nombres, c.apellidoPaterno, c.apellidoMaterno].filter(Boolean).join(' ');
  return {
    id: c.citaId,
    persona,
    fechaHora: dayAndTime(c.programadaEn),
    estado: ESTADO_LABELS[c.estado] ?? c.estado,
  };
}

/** Vista de solo lectura para usuarios externos UMECA vía RPC `get_umeca_citas()`. */
export function UmecaHomeView({ displayName }: { displayName: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['umeca', 'citas'],
    queryFn: fetchUmecaCitas,
    select: (rows) => rows.map(toUmecaRow),
  });

  return (
    <>
      <PageHeader
        title={`Citas UMECA · ${displayName}`}
        documentTitle="Citas UMECA"
        description="Consulta de solo lectura autorizada vía get_umeca_citas(). Sin acceso a expedientes ni datos clínicos."
      />

      {isError ? (
        <div className="rounded-3xl bg-surface-container-low p-10">
          <EmptyState
            illustration="error"
            title="No se pudieron consultar las citas UMECA"
            description="Verifica tu sesión activa en Supabase."
            actions={RETRY_ACTION}
            onAction={() => refetch()}
          />
        </div>
      ) : isLoading ? (
        <div className="h-64 animate-pulse rounded-3xl bg-surface-container" />
      ) : !data?.length ? (
        <div className="rounded-3xl bg-surface-container-low p-10">
          <EmptyState
            illustration="inbox"
            title="Sin citas programadas por UMECA"
            description="Cuando existan citas canalizadas por tu dependencia aparecerán aquí."
          />
        </div>
      ) : (
        <DataTable<UmecaRow> caption="Citas UMECA" rows={data} columns={COLUMNS} pageSize={10} />
      )}
    </>
  );
}
