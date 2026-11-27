import { useCallback, useMemo, useRef } from 'react';
import { EmptyState, Select, toast } from '@yewdiel21/motion-kit/react';
import type { DataTableProps } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/select';
import type { ReporteTipo } from '@/domain/models/Reporte';
import { downloadBlob, toCsvBlob, toXlsx } from '@/shared/export';
import {
  NOTA_SIN_DATOS_PERSONALES,
  chartFromContainer,
  panelPorTitulo,
  usePrintable,
  type PrintBar,
  type PrintReportOptions,
} from '@/shared/print';
import { SkeletonRows } from '@/shared/ui/SkeletonRows';
import { SmallEmptyState } from '@/shared/ui/SmallEmptyState';
import { formatDecimal } from '@/shared/ui/table/tableFormat';
import { VcDataTable } from '@/shared/ui/table/VcDataTable';
import { ChartPanel, HBars, KitChart } from '../ChartPanel';
import { KpiStrip, type KpiItem } from '../KpiStrip';
import { useReporte } from '../api';
import { REPORTES, REPORTE_OPCIONES, esReporteTipo, type ReporteFila, type ReporteGrafica } from './catalogo';
import { insightPuntos } from './estadisticas';
import { etiquetaPeriodo, type Periodo, type Rango } from './periodo';
import { columnasExportacion, reporteFileName } from './reporteExport';
import '../informes.css';

type TablaRow = ReporteFila & Record<string, unknown>;

const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];

export interface ReportesSectionProps {
  tipo: ReporteTipo;
  onTipo: (tipo: ReporteTipo) => void;
  periodo: Periodo;
  rango: Rango;
  /** Área que se consulta (`null` = todas). Solo aplica a los reportes que se dividen por área. */
  areaId: number | null;
  /** Nombre del área para el archivo y el encabezado; `null` = todas. */
  areaNombre: string | null;
  habilitado: boolean;
}

function datosGrafica(grafica: ReporteGrafica) {
  if (grafica.kind === 'hbars') {
    return {
      columns: ['Categoría', 'Total'] as const,
      rows: grafica.puntos.map((p) => [p.label, p.value] as const),
    };
  }
  return {
    columns: ['Categoría', grafica.serie] as const,
    rows: grafica.labels.map((label, i) => [label, grafica.values[i]] as const),
  };
}

function GraficaReporte({ grafica, resumen }: { grafica: ReporteGrafica; resumen: string }) {
  const series = useMemo(
    () => (grafica.kind === 'barras' ? [{ name: grafica.serie, values: grafica.values }] : []),
    [grafica],
  );
  const insight = insightPuntos(grafica.kind === 'hbars' ? grafica.puntos : grafica.labels.map((label, i) => ({ label, value: grafica.values[i] })));
  return (
    <ChartPanel title={grafica.titulo} insight={insight} summary={resumen} data={datosGrafica(grafica)} className="est-report-chart">
      {grafica.kind === 'barras' ? (
        <KitChart label={grafica.titulo} type="bar" labels={grafica.labels} series={series} barWidth={40} height={200} />
      ) : (
        <HBars puntos={grafica.puntos} label={grafica.titulo} />
      )}
    </ChartPanel>
  );
}

/**
 * Reportes por área: selector de tipo (atenciones, citas, canalizaciones, órdenes de protección, actividades
 * preventivas y alertas), indicadores, gráfica y tabla del periodo elegido, con descarga CSV y Excel e impresión / PDF. Solo agregados:
 * nunca nombres ni CURP.
 */
export function ReportesSection({ tipo, onTipo, periodo, rango, areaId, areaNombre, habilitado }: ReportesSectionProps) {
  const def = REPORTES[tipo];
  const areaConsulta = def.aplicaArea ? areaId : null;
  const { data, isPending, isError, refetch } = useReporte(
    { tipo, desde: rango.desde, hasta: rango.hasta, areaId: areaConsulta, agrupar: 'periodo' },
    habilitado,
  );

  const vista = useMemo(() => (data ? def.construir(data) : null), [data, def]);
  const subtitulo = etiquetaPeriodo(periodo);
  const areaArchivo = def.aplicaArea ? areaNombre : null;

  const columns = useMemo<DataTableProps<TablaRow>['columns']>(
    () =>
      (vista?.tabla.columnas ?? []).map((columna) => ({
        key: columna.key,
        label: columna.header,
        ...(columna.numeric
          ? {
              type: 'number' as const,
              align: 'end' as const,
              format: (value: unknown) => (typeof value === 'number' ? formatDecimal(value) : '—'),
            }
          : {}),
        sortable: !vista?.tabla.filas.some((fila) => fila.id === 'total'),
      })),
    [vista],
  );
  const rows = useMemo(() => (vista?.tabla.filas ?? []) as TablaRow[], [vista]);
  // La primera columna de texto identifica la fila (área, destino…): destacada; las de texto se truncan con `title`.
  const textKeys = useMemo(() => (vista?.tabla.columnas ?? []).filter((c) => !c.numeric).map((c) => c.key), [vista]);
  const strongKeys = useMemo(() => textKeys.slice(0, 1), [textKeys]);
  const kpis = useMemo<KpiItem[]>(
    () => (vista?.kpis ?? []).map((kpi) => ({ id: kpi.label, label: kpi.label, value: kpi.value, text: `${kpi.label}: ${kpi.value}` })),
    [vista],
  );

  const exportar = useCallback(
    (formato: 'csv' | 'xlsx') => {
      if (!vista) return;
      const fileName = reporteFileName(tipo, periodo, areaArchivo, formato);
      try {
        const cols = columnasExportacion(vista.tabla);
        const blob =
          formato === 'csv'
            ? toCsvBlob(vista.tabla.filas, cols)
            : toXlsx(vista.tabla.filas, cols, `${def.label} ${subtitulo}`);
        downloadBlob(blob, fileName);
        toast(`Se descargó ${fileName}.`, { tone: 'success' });
      } catch {
        toast('No se pudo generar el archivo del reporte.', { tone: 'error' });
      }
    },
    [vista, tipo, periodo, areaArchivo, def.label, subtitulo],
  );

  const sinDatos = vista?.vacio ?? true;

  // Imprimir / PDF: el mismo contenido que las descargas (columnas de `columnasExportacion`) más indicadores y gráfica.
  const bodyRef = useRef<HTMLDivElement>(null);
  const construirImpresion = useCallback((): PrintReportOptions<ReporteFila> | null => {
    if (!vista || vista.vacio) return null;
    const { grafica } = vista;
    const respaldo: PrintBar[] =
      grafica.kind === 'hbars'
        ? grafica.puntos.map((p) => ({ label: p.label, value: p.value }))
        : grafica.labels.map((label, i) => ({ label, value: grafica.values[i] }));
    const chart = chartFromContainer(panelPorTitulo(bodyRef.current, grafica.titulo), grafica.titulo, respaldo);
    return {
      title: def.label,
      subtitle: def.aplicaArea ? `${subtitulo} · ${areaNombre ?? 'Todas las áreas'}` : subtitulo,
      filtros: [
        { label: 'Tipo de reporte', value: def.label },
        { label: 'Periodo', value: subtitulo },
        { label: 'Área', value: def.aplicaArea ? (areaNombre ?? 'Todas las áreas') : 'No aplica a este reporte' },
      ],
      kpis: vista.kpis,
      columns: columnasExportacion(vista.tabla),
      rows: vista.tabla.filas,
      charts: chart ? [chart] : [],
      nota: NOTA_SIN_DATOS_PERSONALES,
      isTotal: (fila) => fila.id === 'total',
    };
  }, [vista, def, subtitulo, areaNombre]);
  const imprimir = usePrintable(construirImpresion);

  return (
    <section aria-label="Reportes" className="est-reportes">
      <header className="est-reportes__head">
        <div className="est-reportes__pick">
          <div className="w-64 max-w-full">
            <Select
              size="sm"
              label="Tipo de reporte"
              options={REPORTE_OPCIONES}
              value={tipo}
              onChange={(value) => {
                if (esReporteTipo(value)) onTipo(value);
              }}
            />
          </div>
          <p className="est-reportes__desc">{def.descripcion}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="mk-button mk-button--tonal vc-press"
            disabled={sinDatos}
            onClick={() => exportar('csv')}
          >
            Descargar CSV
          </button>
          <button
            type="button"
            className="mk-button mk-button--tonal vc-press"
            disabled={sinDatos}
            onClick={() => exportar('xlsx')}
          >
            Descargar Excel
          </button>
          <button
            type="button"
            className="mk-button mk-button--tonal vc-press"
            disabled={sinDatos}
            onClick={() => imprimir()}
          >
            Imprimir / PDF
          </button>
        </div>
      </header>

      {isError ? (
        <div className="rounded-3xl bg-surface-container-low p-6">
          <EmptyState
            illustration="error"
            title="No se pudo cargar el reporte"
            description="Verifica tu conexión e inténtalo de nuevo."
            actions={RETRY_ACTION}
            onAction={() => refetch()}
          />
        </div>
      ) : isPending || !vista ? (
        <SkeletonRows label="Cargando reporte" rows={4} rowHeight="3rem" />
      ) : vista.vacio ? (
        <SmallEmptyState
          icon="monitoring"
          title="Sin datos en este periodo"
          description={`No hay registros de ${def.label.toLowerCase()} en ${subtitulo}. Prueba con otro periodo o área.`}
        />
      ) : (
        <div className="est-body" ref={bodyRef}>
          <KpiStrip items={kpis} label={`${def.label}, ${subtitulo}`} />
          <div className="est-report-grid">
            <GraficaReporte grafica={vista.grafica} resumen={vista.resumenGrafica} />
            <VcDataTable<TablaRow>
              key={tipo}
              className="est-table"
              strong={strongKeys}
              truncate={textKeys}
              caption={`${def.label}, ${subtitulo}`}
              rows={rows}
              columns={columns}
              pageSize={10}
              search={false}
              filters={false}
              columnsMenu={false}
            />
          </div>
        </div>
      )}
    </section>
  );
}
