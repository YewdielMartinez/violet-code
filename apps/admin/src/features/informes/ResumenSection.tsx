import { useCallback, useMemo, useRef } from 'react';
import { EmptyState } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import {
  NOTA_SIN_DATOS_PERSONALES,
  chartFromContainer,
  panelPorTitulo,
  usePrintable,
  type PrintChart,
  type PrintReportOptions,
} from '@/shared/print';
import { SmallEmptyState } from '@/shared/ui/SmallEmptyState';
import { ChartPanel, ChartSkeleton, HBars, KitChart } from './ChartPanel';
import { KpiStrip, deltaTexto, type KpiItem } from './KpiStrip';
import { useReporte } from './api';
import {
  distribucionPorArea,
  distribucionPorSexo,
  distribucionPorTipo,
  filasDelPeriodo,
  insightPuntos,
  insightSerie,
  insightSeguimiento,
  kpisAtenciones,
  kpiTexto,
  resumenDeTotal,
  resumenPuntos,
  resumenSerie,
  serieAtenciones,
  serieSeguimiento,
} from './reportes/estadisticas';
import { mesesEnRango, rangoValido, type Rango } from './reportes/periodo';
import './informes.css';

const RETRY_ACTION = [{ id: 'retry', label: 'Reintentar' }];

export interface ResumenSectionProps {
  /** Rango del periodo elegido. */
  rango: Rango;
  /** Mismo largo, inmediatamente antes (para la variación de los KPI). */
  rangoAnterior: Rango;
  /** Ventana de la tendencia mensual (12 meses, el año o el rango). */
  rangoTendencia: Rango;
  /** `null` = todas las áreas (solo Dirección). */
  areaId: number | null;
  /** Dirección sin área elegida: se agrega la gráfica «por área». */
  mostrarPorArea: boolean;
  /** `false` si el rango es inválido: no se consulta nada. */
  habilitado: boolean;
  /** Texto del periodo para el estado vacío («Marzo 2026»). */
  etiquetaPeriodo: string;
  /** Nombre del área para el encabezado del PDF; `null` o ausente = todas. */
  areaNombre?: string | null;
}

/** Fila de la tabla del PDF: la tendencia mensual (lo que hay detrás de las gráficas de serie). */
interface FilaMensual {
  mes: string;
  atenciones: number;
  primeraVez: number;
  seguimiento: number;
}

const COLUMNAS_MENSUALES = [
  { key: 'mes', header: 'Mes', value: (f: FilaMensual) => f.mes },
  { key: 'atenciones', header: 'Atenciones', value: (f: FilaMensual) => f.atenciones },
  { key: 'primeraVez', header: 'Primera vez', value: (f: FilaMensual) => f.primeraVez },
  { key: 'seguimiento', header: 'Seguimiento', value: (f: FilaMensual) => f.seguimiento },
];

/**
 * Resumen analítico de atenciones: franja de KPI con variación contra el periodo anterior y gráficas (tendencia
 * mensual, primera vez vs seguimiento, personas por sexo, tipos de atención y, para Dirección, por área). Todo sale de
 * `get_reporte('atenciones')`: conteos agregados, sin datos personales.
 */
export function ResumenSection({
  rango,
  rangoAnterior,
  rangoTendencia,
  areaId,
  mostrarPorArea,
  habilitado,
  etiquetaPeriodo,
  areaNombre = null,
}: ResumenSectionProps) {
  const serieQuery = useReporte(
    { tipo: 'atenciones', desde: rangoTendencia.desde, hasta: rangoTendencia.hasta, areaId, agrupar: 'mes' },
    habilitado,
  );
  const totalQuery = useReporte(
    { tipo: 'atenciones', desde: rango.desde, hasta: rango.hasta, areaId, agrupar: 'total' },
    habilitado,
  );
  const previoQuery = useReporte(
    { tipo: 'atenciones', desde: rangoAnterior.desde, hasta: rangoAnterior.hasta, areaId, agrupar: 'total' },
    habilitado && rangoValido(rangoAnterior),
  );

  const meses = useMemo(() => (rangoValido(rangoTendencia) ? mesesEnRango(rangoTendencia) : []), [rangoTendencia]);
  const serieRows = serieQuery.data;
  const periodoRows = useMemo(() => (serieRows ? filasDelPeriodo(serieRows, rango) : []), [serieRows, rango]);
  const actual = useMemo(() => resumenDeTotal(totalQuery.data), [totalQuery.data]);
  const previo = useMemo(() => (previoQuery.data ? resumenDeTotal(previoQuery.data) : null), [previoQuery.data]);

  const kpis = useMemo<KpiItem[]>(
    () =>
      kpisAtenciones(actual, previo).map((kpi) => ({
        id: kpi.id,
        label: kpi.label,
        value: kpi.value,
        delta: kpi.delta,
        text: kpiTexto(kpi),
      })),
    [actual, previo],
  );

  const mensual = useMemo(() => serieAtenciones(serieRows ?? [], meses), [serieRows, meses]);
  const seguimiento = useMemo(() => serieSeguimiento(serieRows ?? [], meses), [serieRows, meses]);
  const sexo = useMemo(() => distribucionPorSexo(actual), [actual]);
  const porTipo = useMemo(() => distribucionPorTipo(periodoRows), [periodoRows]);
  const porArea = useMemo(() => distribucionPorArea(periodoRows), [periodoRows]);

  const seriesTendencia = useMemo(() => [{ name: 'Atenciones', values: mensual.values }], [mensual]);
  const seriesSeguimiento = useMemo(
    () => [
      { name: 'Primera vez', values: seguimiento.primeraVez },
      { name: 'Seguimiento', values: seguimiento.seguimiento },
    ],
    [seguimiento],
  );
  const seriesSexo = useMemo(() => [{ name: 'Personas', values: sexo.map((p) => p.value) }], [sexo]);
  const seriesArea = useMemo(() => [{ name: 'Atenciones', values: porArea.map((p) => p.value) }], [porArea]);
  const labelsSexo = useMemo(() => sexo.map((p) => p.label), [sexo]);
  const labelsArea = useMemo(() => porArea.map((p) => p.label), [porArea]);

  // Imprimir / PDF: KPI, gráficas visibles (SVG) y la tabla de la tendencia mensual.
  const bodyRef = useRef<HTMLDivElement>(null);
  const construirImpresion = useCallback((): PrintReportOptions<FilaMensual> | null => {
    if (!habilitado || serieQuery.isPending || totalQuery.isPending || serieQuery.isError || totalQuery.isError) {
      return null;
    }
    const rows: FilaMensual[] = mensual.largas.map((mes, i) => ({
      mes,
      atenciones: mensual.values[i] ?? 0,
      primeraVez: seguimiento.primeraVez[i] ?? 0,
      seguimiento: seguimiento.seguimiento[i] ?? 0,
    }));
    const panel = (titulo: string) => panelPorTitulo(bodyRef.current, titulo);
    const charts = [
      chartFromContainer(
        panel('Atenciones por mes'),
        'Atenciones por mes',
        mensual.largas.map((label, i) => ({ label, value: mensual.values[i] ?? 0 })),
      ),
      chartFromContainer(panel('Primera vez y seguimiento'), 'Primera vez y seguimiento'),
      chartFromContainer(panel('Mujeres y hombres atendidos'), 'Mujeres y hombres atendidos', sexo),
      chartFromContainer(panel('Atenciones por tipo de atención'), 'Atenciones por tipo de atención', porTipo),
      ...(mostrarPorArea ? [chartFromContainer(panel('Atenciones por área'), 'Atenciones por área', porArea)] : []),
    ].filter((c): c is PrintChart => c !== null);
    return {
      title: 'Resumen de atenciones',
      subtitle: `${etiquetaPeriodo} · ${areaNombre ?? 'Todas las áreas'}`,
      filtros: [
        { label: 'Periodo', value: etiquetaPeriodo },
        { label: 'Área', value: areaNombre ?? 'Todas las áreas' },
      ],
      kpis: kpis.map((kpi) => {
        const cambio = kpi.delta ? deltaTexto(kpi.delta) : null;
        return { label: kpi.label, value: kpi.value, ...(cambio ? { nota: cambio } : {}) };
      }),
      columns: COLUMNAS_MENSUALES,
      rows,
      charts,
      nota: NOTA_SIN_DATOS_PERSONALES,
    };
  }, [
    habilitado,
    serieQuery.isPending,
    serieQuery.isError,
    totalQuery.isPending,
    totalQuery.isError,
    mensual,
    seguimiento,
    sexo,
    porTipo,
    porArea,
    mostrarPorArea,
    etiquetaPeriodo,
    areaNombre,
    kpis,
  ]);
  const imprimir = usePrintable(construirImpresion);

  if (!habilitado) return null;

  if (serieQuery.isError || totalQuery.isError) {
    return (
      <div className="rounded-3xl bg-surface-container-low p-6">
        <EmptyState
          illustration="error"
          title="No se pudieron cargar las estadísticas"
          description="Verifica tu conexión e inténtalo de nuevo."
          actions={RETRY_ACTION}
          onAction={() => {
            void serieQuery.refetch();
            void totalQuery.refetch();
          }}
        />
      </div>
    );
  }

  if (serieQuery.isPending || totalQuery.isPending) return <ChartSkeleton label="Cargando estadísticas" />;

  if (actual.atenciones === 0 && periodoRows.length === 0) {
    return (
      <SmallEmptyState
        icon="monitoring"
        title="Sin atenciones en este periodo"
        description={`No hay atenciones registradas en ${etiquetaPeriodo}. Prueba con otro periodo o área.`}
      />
    );
  }

  const tendenciaBarras = meses.length < 3;

  return (
    <div className="est-body" ref={bodyRef}>
      <div className="est-actions">
        <button type="button" className="mk-button mk-button--tonal vc-press" onClick={() => imprimir()}>
          Imprimir / PDF
        </button>
      </div>
      <KpiStrip items={kpis} label={`Indicadores de ${etiquetaPeriodo}`} />

      <div className="est-grid">
        <ChartPanel
          className="est-span-2"
          title="Atenciones por mes"
          insight={insightSerie(mensual.values)}
          summary={resumenSerie('Atenciones por mes', mensual.largas, mensual.values)}
          data={{ columns: ['Mes', 'Atenciones'], rows: mensual.largas.map((mes, i) => [mes, mensual.values[i]]) }}
        >
          <KitChart
            label="Atenciones por mes"
            type={tendenciaBarras ? 'bar' : 'area'}
            labels={mensual.labels}
            series={seriesTendencia}
            barWidth={44}
          />
        </ChartPanel>

        <ChartPanel
          title="Primera vez y seguimiento"
          insight={insightSeguimiento(seguimiento.primeraVez, seguimiento.seguimiento)}
          summary={resumenSerie(
            'Atenciones de primera vez y seguimiento por mes',
            seguimiento.largas,
            seguimiento.primeraVez.map((v, i) => v + seguimiento.seguimiento[i]),
          )}
          data={{
            columns: ['Mes', 'Primera vez', 'Seguimiento'],
            rows: seguimiento.largas.map((mes, i) => [mes, seguimiento.primeraVez[i], seguimiento.seguimiento[i]]),
          }}
        >
          <KitChart
            label="Primera vez y seguimiento por mes"
            type="bar"
            stacked
            labels={seguimiento.labels}
            series={seriesSeguimiento}
          />
        </ChartPanel>

        <ChartPanel
          title="Mujeres y hombres atendidos"
          insight={insightPuntos(sexo)}
          summary={resumenPuntos('Personas atendidas por sexo', sexo)}
          data={{ columns: ['Sexo', 'Personas'], rows: sexo.map((p) => [p.label, p.value]) }}
        >
          <KitChart label="Personas atendidas por sexo" type="bar" labels={labelsSexo} series={seriesSexo} barWidth={56} />
        </ChartPanel>

        <ChartPanel
          title="Atenciones por tipo de atención"
          insight={insightPuntos(porTipo)}
          summary={resumenPuntos('Atenciones por tipo de atención', porTipo)}
          data={{ columns: ['Tipo de atención', 'Atenciones'], rows: porTipo.map((p) => [p.label, p.value]) }}
        >
          <HBars puntos={porTipo} label="Atenciones por tipo de atención" />
        </ChartPanel>

        {mostrarPorArea ? (
          <ChartPanel
            title="Atenciones por área"
            insight={insightPuntos(porArea)}
            summary={resumenPuntos('Atenciones por área', porArea)}
            data={{ columns: ['Área', 'Atenciones'], rows: porArea.map((p) => [p.label, p.value]) }}
          >
            <KitChart label="Atenciones por área" type="bar" labels={labelsArea} series={seriesArea} barWidth={56} />
          </ChartPanel>
        ) : null}
      </div>
    </div>
  );
}
