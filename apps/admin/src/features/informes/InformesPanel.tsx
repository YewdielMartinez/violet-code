import { useCallback, useMemo, useState } from 'react';
import { AnimatedNumber, DataTable, EmptyState, Select, toast } from '@yewdiel21/motion-kit/react';
import type { DataTableProps } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/data-table';
import '@yewdiel21/motion-kit/css/components/filter-builder';
import '@yewdiel21/motion-kit/css/components/menu';
import '@yewdiel21/motion-kit/css/components/select';
import '@yewdiel21/motion-kit/css/components/pagination';
import '@yewdiel21/motion-kit/css/components/empty-state';
import type { InformeRow } from '@/domain/models/Informe';
import { useAuth } from '@/shared/auth/useAuth';
import { downloadBlob, toXlsx } from '@/shared/export';
import { Icon } from '@/shared/ui/Icon';
import { SegmentedTabs, type SegmentedOption } from '@/shared/ui/SegmentedTabs';
import { SkeletonRows } from '@/shared/ui/SkeletonRows';
import { SmallEmptyState } from '@/shared/ui/SmallEmptyState';
import { useInforme } from './api';
import {
  INFORME_EXPORT_COLUMNS,
  SEGUIMIENTO_LABELS,
  assertNoPiiColumns,
  informeFileName,
  resumirInforme,
} from './informeExport';
import { puedeVerInformes } from './informesPermisos';
import './informes.css';

type Periodo = 'mensual' | 'anual';
type InformeTableRow = {
  id: string;
  area: string;
  tipoAtencion: string;
  seguimiento: string;
  mujeres: number;
  hombres: number;
  totalPersonas: number;
  totalAtenciones: number;
} & Record<string, unknown>;

const PERIODO_OPTIONS: readonly SegmentedOption<Periodo>[] = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'anual', label: 'Anual' },
];

export const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

const MES_OPTIONS = MESES.map((label, i) => ({ value: String(i + 1), label }));

const COLUMNS: DataTableProps<InformeTableRow>['columns'] = [
  { key: 'area', label: 'Área', sortable: true },
  { key: 'tipoAtencion', label: 'Tipo de atención', sortable: true },
  { key: 'seguimiento', label: 'Primera vez / Seguimiento', sortable: true },
  { key: 'mujeres', label: 'Mujeres', type: 'number', align: 'end', sortable: true },
  { key: 'hombres', label: 'Hombres', type: 'number', align: 'end', sortable: true },
  { key: 'totalPersonas', label: 'Personas', type: 'number', align: 'end', sortable: true },
  { key: 'totalAtenciones', label: 'Atenciones', type: 'number', align: 'end', sortable: true },
];

const SORT_AREA = { key: 'area', direction: 'asc' } as const;
const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];
const formatNumber = (n: number) => Math.round(n).toLocaleString('es-MX');

function toTableRow(row: InformeRow, index: number): InformeTableRow {
  return {
    id: `${index}-${row.areaId}-${row.tipoAtencion}-${row.primeraVezOSeguimiento}`,
    area: row.area,
    tipoAtencion: row.tipoAtencion,
    seguimiento: SEGUIMIENTO_LABELS[row.primeraVezOSeguimiento],
    mujeres: row.mujeres,
    hombres: row.hombres,
    totalPersonas: row.totalPersonas,
    totalAtenciones: row.totalAtenciones,
  };
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="inf-kpi" role="group" aria-label={`${label}: ${formatNumber(value)}`}>
      <span className="inf-kpi__value" aria-hidden>
        <AnimatedNumber value={value} format={formatNumber} />
      </span>
      <span className="inf-kpi__label" aria-hidden>
        {label}
      </span>
    </div>
  );
}

/** Años seleccionables: el actual y los dos anteriores. */
export function yearOptions(current: number) {
  return [current, current - 1, current - 2].map((y) => ({ value: String(y), label: String(y) }));
}

export interface InformesPanelProps {
  /** Fecha de referencia (año y mes iniciales); por defecto, hoy. Útil en pruebas. */
  now?: Date;
}

/**
 * Informe estadístico (`get_informe`): conteos por área, tipo de atención y primera vez / seguimiento, mensual o
 * anual, con descarga CSV y Excel. Dirección ve todas las áreas; las áreas de atención, solo la suya (lo filtra el
 * servidor). Recepción y UMECA no tienen `informe.ver`: no se monta.
 */
export function InformesPanel({ now }: InformesPanelProps) {
  const { user } = useAuth();
  const permitido = puedeVerInformes(user?.role);

  const [reference] = useState(() => now ?? new Date());
  const currentYear = reference.getFullYear();
  const [periodo, setPeriodo] = useState<Periodo>('mensual');
  const [anio, setAnio] = useState(currentYear);
  const [mes, setMes] = useState(reference.getMonth() + 1);
  const mesFiltro = periodo === 'anual' ? null : mes;

  const years = useMemo(() => yearOptions(currentYear), [currentYear]);
  const { data, isPending, isError, refetch } = useInforme({ anio, mes: mesFiltro }, permitido);
  const rows = useMemo(() => data ?? [], [data]);
  const tableRows = useMemo(() => rows.map(toTableRow), [rows]);
  const resumen = useMemo(() => resumirInforme(rows), [rows]);
  const sinDatos = rows.length === 0;

  const subtitle = mesFiltro === null ? `Año ${anio}` : `${MESES[mesFiltro - 1]} ${anio}`;

  const exportar = useCallback(() => {
    const fileName = informeFileName(anio, mesFiltro, 'xlsx');
    try {
      assertNoPiiColumns(INFORME_EXPORT_COLUMNS);
      const blob = toXlsx(rows, INFORME_EXPORT_COLUMNS, `Informe ${subtitle}`);
      downloadBlob(blob, fileName);
      toast(`Se descargó ${fileName}.`, { tone: 'success' });
    } catch {
      toast('No se pudo generar el archivo del informe.', { tone: 'error' });
    }
  }, [anio, mesFiltro, rows, subtitle]);

  if (!permitido) return null;

  return (
    <section
      aria-label="Informes"
      className="@container flex min-h-0 flex-col gap-4 overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-lowest p-4 @sm:p-5"
    >
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary-container text-on-secondary-container"
          >
            <Icon name="monitoring" className="text-[18px]" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base leading-tight font-medium text-on-surface">Informes</h2>
            <p className="truncate text-xs text-on-surface-variant">{subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          className="mk-button mk-button--tonal vc-press"
          disabled={sinDatos}
          onClick={exportar}
        >
          Descargar Excel
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedTabs label="Periodo del informe" options={PERIODO_OPTIONS} value={periodo} onChange={setPeriodo} />
        <div className="w-28">
          <Select
            size="sm"
            label="Año"
            options={years}
            value={String(anio)}
            onChange={(value) => setAnio(Number(value))}
          />
        </div>
        {periodo === 'mensual' ? (
          <div className="w-40">
            <Select size="sm" label="Mes" options={MES_OPTIONS} value={String(mes)} onChange={(value) => setMes(Number(value))} />
          </div>
        ) : null}
      </div>

      {isError ? (
        <div className="rounded-3xl bg-surface-container-low p-6">
          <EmptyState
            illustration="error"
            title="No se pudo cargar el informe"
            description="Verifica tu conexión e inténtalo de nuevo."
            actions={RETRY_ACTION}
            onAction={() => refetch()}
          />
        </div>
      ) : isPending ? (
        <SkeletonRows label="Cargando informe" rows={4} rowHeight="3rem" />
      ) : sinDatos ? (
        <SmallEmptyState
          icon="monitoring"
          title="Sin atenciones en este periodo"
          description="Cuando se registren atenciones del periodo elegido aparecerán aquí."
        />
      ) : (
        <div key={`${periodo}-${anio}-${mes}`} className="inf-body grid gap-4">
          <div className="grid grid-cols-1 gap-3 @md:grid-cols-3">
            <Kpi label="Atenciones" value={resumen.total} />
            <Kpi label="Primera vez" value={resumen.primeraVez} />
            <Kpi label="Seguimiento" value={resumen.seguimiento} />
          </div>
          <DataTable<InformeTableRow>
            className="vc-expediente-table inf-table"
            caption={`Informe de atenciones, ${subtitle}`}
            rows={tableRows}
            columns={COLUMNS}
            sort={SORT_AREA}
            pageSize={10}
            search={false}
            filters={false}
            columnsMenu={false}
          />
        </div>
      )}
    </section>
  );
}
