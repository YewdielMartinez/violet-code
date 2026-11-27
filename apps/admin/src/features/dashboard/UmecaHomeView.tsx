import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState } from '@yewdiel21/motion-kit/react';
import type { DataTableProps } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import { fetchUmecaCitas, type UmecaCita } from '@/shared/auth/session';
import { Icon } from '@/shared/ui/Icon';
import { PageHeader } from '@/shared/ui/PageHeader';
import { pillElement } from '@/shared/ui/table/tableDecorate';
import { VcDataTable } from '@/shared/ui/table/VcDataTable';
import {
  ASISTENCIA_OPCIONES,
  areaUmecaLabel,
  asistenciaInfo,
  fechaCitaUmeca,
  opcionesArea,
  resumenAsistencia,
  type AsistenciaInfo,
} from './umecaAsistencia';

type UmecaRow = {
  id: string;
  persona: string;
  programadaEn: string;
  /** Nombre del área que atiende la cita («Trabajo Social», «Psicología», «Jurídico» o «Sin área»). */
  area: string;
  /** Clave de asistencia (`asistio`, `no_asistio`, `pendiente`, `cancelo`). */
  estado: string;
} & Record<string, unknown>;

/** Píldora de estado: ícono + texto (no depende solo del color) con tokens del tema. */
const CHIP_BASE =
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.8125rem] font-semibold leading-none whitespace-nowrap';

/** Celda de asistencia del `DataTable` (API vanilla): cápsula del sistema con ícono + texto (no depende solo del color). */
function renderEstado(value: unknown): HTMLElement {
  const info = asistenciaInfo(String(value));
  return pillElement(info.label, info.tone, info.icon);
}

function buildColumns(areas: readonly string[]): DataTableProps<UmecaRow>['columns'] {
  return [
    { key: 'persona', label: 'Persona canalizada', sortable: true, searchable: true },
    {
      key: 'programadaEn',
      label: 'Fecha y hora',
      type: 'date',
      sortable: true,
      format: (value) => fechaCitaUmeca(String(value)),
    },
    {
      key: 'area',
      label: 'Área',
      type: 'select',
      options: opcionesArea(areas),
      sortable: true,
      filterable: true,
    },
    {
      key: 'estado',
      label: 'Asistencia',
      type: 'select',
      options: ASISTENCIA_OPCIONES,
      sortable: true,
      filterable: true,
      render: renderEstado,
    },
  ];
}

/** Columna principal de la tabla: la persona canalizada. */
const UMECA_STRONG = ['persona'];
const SORT_RECIENTES = { key: 'programadaEn', direction: 'desc' } as const;
const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];

function toUmecaRow(c: UmecaCita): UmecaRow {
  const persona = [c.nombres, c.apellidoPaterno, c.apellidoMaterno].filter(Boolean).join(' ');
  return {
    id: c.citaId,
    persona,
    programadaEn: c.programadaEn,
    area: areaUmecaLabel(c.areaClave, c.areaNombre),
    estado: asistenciaInfo(c.estado).clave,
  };
}

function ResumenChip({ info, total }: { info: AsistenciaInfo; total: number }) {
  return (
    <li className={`${CHIP_BASE} !px-3.5 !py-2 ${info.chipClass}`}>
      <Icon name={info.icon} className="text-[18px]" />
      <span className="tabular-nums">{total}</span>
      <span className="font-medium">{info.label}</span>
    </li>
  );
}

/** Vista de solo lectura para usuarios externos UMECA vía RPC `get_umeca_citas()`. */
export function UmecaHomeView({ displayName }: { displayName: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['umeca', 'citas'],
    queryFn: fetchUmecaCitas,
    select: (rows) => ({ filas: rows.map(toUmecaRow), resumen: resumenAsistencia(rows.map((r) => r.estado)) }),
  });

  const columns = useMemo(() => buildColumns((data?.filas ?? []).map((f) => f.area)), [data?.filas]);

  return (
    <>
      <PageHeader
        title={`Citas UMECA · ${displayName}`}
        documentTitle="Citas UMECA"
        description="Asistencia de las mujeres canalizadas por tu dependencia con cita obligatoria. Consulta de solo lectura, sin acceso a expedientes ni datos clínicos."
      />

      {isError ? (
        <div className="rounded-3xl bg-surface-container-low p-10">
          <EmptyState
            illustration="error"
            title="No se pudieron consultar las citas UMECA"
            description="Verifica tu sesión activa e inténtalo de nuevo."
            actions={RETRY_ACTION}
            onAction={() => refetch()}
          />
        </div>
      ) : isLoading ? (
        <div className="h-64 animate-pulse rounded-3xl bg-surface-container" />
      ) : !data?.filas.length ? (
        <div className="rounded-3xl bg-surface-container-low p-10">
          <EmptyState
            illustration="inbox"
            title="Sin citas programadas por UMECA"
            description="Cuando existan citas canalizadas por tu dependencia aparecerán aquí."
          />
        </div>
      ) : (
        <div className="grid gap-4">
          <ul aria-label="Resumen de asistencia" className="flex flex-wrap gap-2">
            <ResumenChip info={asistenciaInfo('asistio')} total={data.resumen.asistio} />
            <ResumenChip info={asistenciaInfo('no_asistio')} total={data.resumen.no_asistio} />
            <ResumenChip info={asistenciaInfo('pendiente')} total={data.resumen.pendiente} />
            {data.resumen.cancelo > 0 ? <ResumenChip info={asistenciaInfo('cancelo')} total={data.resumen.cancelo} /> : null}
          </ul>
          <VcDataTable<UmecaRow>
            strong={UMECA_STRONG}
            caption="Asistencia de citas UMECA"
            rows={data.filas}
            columns={columns}
            sort={SORT_RECIENTES}
            pageSize={10}
          />
        </div>
      )}
    </>
  );
}
