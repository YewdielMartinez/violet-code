import { useMemo } from 'react';
import { EmptyState } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import { SmallEmptyState } from '@/shared/ui/SmallEmptyState';
import { ChartPanel, ChartSkeleton, HBars, KitChart } from './ChartPanel';
import { KpiStrip, type KpiItem } from './KpiStrip';
import { useReporte } from './api';
import {
  distribucionPorArea,
  distribucionPorSexo,
  distribucionPorTipo,
  filasDelPeriodo,
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
}

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
    <div className="est-body">
      <KpiStrip items={kpis} label={`Indicadores de ${etiquetaPeriodo}`} />

      <div className="est-grid">
        <ChartPanel
          className="est-span-2"
          title="Atenciones por mes"
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
          summary={resumenPuntos('Personas atendidas por sexo', sexo)}
          data={{ columns: ['Sexo', 'Personas'], rows: sexo.map((p) => [p.label, p.value]) }}
        >
          <KitChart label="Personas atendidas por sexo" type="bar" labels={labelsSexo} series={seriesSexo} barWidth={56} />
        </ChartPanel>

        <ChartPanel
          title="Atenciones por tipo de atención"
          summary={resumenPuntos('Atenciones por tipo de atención', porTipo)}
          data={{ columns: ['Tipo de atención', 'Atenciones'], rows: porTipo.map((p) => [p.label, p.value]) }}
        >
          <HBars puntos={porTipo} label="Atenciones por tipo de atención" />
        </ChartPanel>

        {mostrarPorArea ? (
          <ChartPanel
            title="Atenciones por área"
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
