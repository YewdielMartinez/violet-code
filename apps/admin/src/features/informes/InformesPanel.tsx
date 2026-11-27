import { useMemo, useState } from 'react';
import { DataTable, type DataTableProps } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/data-table';
import type { InformeRow } from '@/domain/models/Informe';
import { KpiTile } from '@/features/dashboard/widgets/KpiTile';
import { WidgetCard, WidgetSkeleton } from '@/features/dashboard/widgets/shared';
import { Icon } from '@/shared/ui/Icon';
import { SegmentedTabs } from '@/shared/ui/SegmentedTabs';
import { SmallEmptyState } from '@/shared/ui/SmallEmptyState';
import { useInforme } from './api';

type PeriodoTab = 'mensual' | 'anual';

type InformeTableRow = {
  id: string;
  area: string;
  tipoAtencion: string;
  clasificacion: string;
  mujeres: number;
  hombres: number;
  totalPersonas: number;
  totalAtenciones: number;
} & Record<string, unknown>;

const TABS = [
  { value: 'mensual' as const, label: 'Mensual' },
  { value: 'anual' as const, label: 'Anual' },
];

const MESES: readonly { value: number; label: string }[] = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

const COLUMNS: DataTableProps<InformeTableRow>['columns'] = [
  { key: 'area', label: 'Área', sortable: true, searchable: true },
  { key: 'tipoAtencion', label: 'Tipo de atención', sortable: true, searchable: true },
  { key: 'clasificacion', label: 'Primera vez / Seguimiento', sortable: true },
  { key: 'mujeres', label: 'Mujeres', type: 'number', sortable: true },
  { key: 'hombres', label: 'Hombres', type: 'number', sortable: true },
  { key: 'totalPersonas', label: 'Personas', type: 'number', sortable: true },
  { key: 'totalAtenciones', label: 'Atenciones', type: 'number', sortable: true },
];

const SELECT_CLASS =
  'rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none';

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildInformeCsv(rows: readonly InformeRow[]): string {
  const header = [
    'Área',
    'Tipo de atención',
    'Primera vez / Seguimiento',
    'Mujeres',
    'Hombres',
    'Personas',
    'Atenciones',
  ];
  const lines = rows.map((row) => [
    row.area,
    row.tipoAtencion,
    row.primeraVezOSeguimiento === 'primera_vez' ? 'Primera vez' : 'Seguimiento',
    row.mujeres,
    row.hombres,
    row.totalPersonas,
    row.totalAtenciones,
  ]);
  return [header, ...lines].map((cols) => cols.map(escapeCsvCell).join(',')).join('\n');
}

export function buildInformeFilename(anio: number, mes: number | null): string {
  if (mes === null) return `informe-${anio}.csv`;
  return `informe-${anio}-${String(mes).padStart(2, '0')}.csv`;
}

const INITIAL_YEAR = new Date().getFullYear();
const YEARS = [INITIAL_YEAR, INITIAL_YEAR - 1, INITIAL_YEAR - 2];

/** Panel de informes estadísticos mensual y anual con descarga CSV (`#186`). */
export function InformesPanel() {
  const [anio, setAnio] = useState<number>(INITIAL_YEAR);
  const [mes, setMes] = useState<number>(() => new Date().getMonth() + 1);
  const [tab, setTab] = useState<PeriodoTab>('mensual');
  const years = YEARS;

  const activeMes = tab === 'anual' ? null : mes;
  const informeQuery = useInforme({ anio, mes: activeMes });
  const rows = useMemo(() => informeQuery.data ?? [], [informeQuery.data]);

  const resumen = useMemo(() => {
    let primeraVez = 0;
    let seguimiento = 0;
    for (const row of rows) {
      if (row.primeraVezOSeguimiento === 'primera_vez') primeraVez += row.totalAtenciones;
      else seguimiento += row.totalAtenciones;
    }
    return {
      total: primeraVez + seguimiento,
      primeraVez,
      seguimiento,
    };
  }, [rows]);

  const tableRows = useMemo<InformeTableRow[]>(
    () =>
      rows.map((row, idx) => ({
        id: `${row.areaId}-${row.tipoAtencion}-${row.primeraVezOSeguimiento}-${idx}`,
        area: row.area,
        tipoAtencion: row.tipoAtencion,
        clasificacion: row.primeraVezOSeguimiento === 'primera_vez' ? 'Primera vez' : 'Seguimiento',
        mujeres: row.mujeres,
        hombres: row.hombres,
        totalPersonas: row.totalPersonas,
        totalAtenciones: row.totalAtenciones,
      })),
    [rows],
  );

  function handleDescargarCsv() {
    if (rows.length === 0) return;
    const csv = buildInformeCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = buildInformeFilename(anio, activeMes);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <WidgetCard title="Informes" subtitle="Resumen mensual y anual de atenciones" icon="summarize">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedTabs<PeriodoTab>
              label="Tipo de informe"
              options={TABS}
              value={tab}
              onChange={setTab}
            />

            <select
              aria-label="Año"
              className={SELECT_CLASS}
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            {tab === 'mensual' ? (
              <select
                aria-label="Mes"
                className={SELECT_CLASS}
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
              >
                {MESES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <button
            type="button"
            className="mk-button mk-button--outlined inline-flex items-center gap-2 rounded-full border border-outline px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
            disabled={rows.length === 0 || informeQuery.isLoading}
            onClick={handleDescargarCsv}
          >
            <Icon name="download" />
            <span>Descargar CSV</span>
          </button>
        </div>

        {informeQuery.isLoading ? (
          <WidgetSkeleton variant="list" />
        ) : informeQuery.isError ? (
          <SmallEmptyState
            icon="error"
            title="Error al cargar informe"
            description="No se pudo cargar el informe del periodo seleccionado."
          />
        ) : rows.length === 0 ? (
          <SmallEmptyState
            icon="bar_chart"
            title="Sin atenciones registradas"
            description="No hay atenciones registradas en el periodo seleccionado."
          />
        ) : (
          <div className="grid gap-4">
            <KpiTile
              value={resumen.total}
              loading={false}
              error={false}
              secondary={`Primera vez: ${resumen.primeraVez} · Seguimiento: ${resumen.seguimiento}`}
            />

            <DataTable<InformeTableRow>
              rows={tableRows}
              columns={COLUMNS}
              pageSize={10}
            />
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
