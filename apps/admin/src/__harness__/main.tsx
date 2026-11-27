import { createRoot } from 'react-dom/client';
import '../index.css';
import { VcDataTable } from '@/shared/ui/table/VcDataTable';
import { numericColumn } from '@/shared/ui/table/tableFormat';
import { ChartPanel, HBars, KitChart } from '@/features/informes/ChartPanel';
import { Sparkline } from '@/features/dashboard/widgets/Sparkline';
import { insightSerie } from '@/features/informes/reportes/estadisticas';
import type { RowDecorSpec } from '@/shared/ui/table/tableDecorate';
import type { DataTableProps } from '@yewdiel21/motion-kit/react';

type R = { id: string; folio: string; nombre: string; estado: string; area: string; total: number; actualizado: string } & Record<string, unknown>;
const ESTADOS = ['Abierto', 'En seguimiento', 'Cerrado'];
const rows: R[] = Array.from({ length: 28 }, (_, i) => ({
  id: String(i),
  folio: `EXP-2026-${String(1000 + i)}`,
  nombre: i % 5 === 0 ? 'María Guadalupe Hernández de la Cruz Villanueva Sánchez' : `Persona ${i} Apellido`,
  estado: ESTADOS[i % 3],
  area: ['Psicología', 'Trabajo Social', 'Jurídico'][i % 3],
  total: i * 37 + 3,
  actualizado: `${(i % 28) + 1} nov 2026`,
}));
const columns: DataTableProps<R>['columns'] = [
  { key: 'folio', label: 'Folio', sortable: true, searchable: true },
  { key: 'nombre', label: 'Usuaria', sortable: true, searchable: true },
  { key: 'estado', label: 'Estado', type: 'select', filterable: true, options: ESTADOS.map((e) => ({ value: e, label: e })) },
  { key: 'area', label: 'Área', sortable: true },
  numericColumn<R>('total', 'Atenciones'),
  { key: 'actualizado', label: 'Actualizado', sortable: true },
];
const DECOR = {
  pills: { estado: { tones: { Abierto: 'info', 'En seguimiento': 'warning', Cerrado: 'success' } } },
  strong: ['nombre'], mono: ['folio'], muted: ['actualizado'], truncate: ['nombre'], interactive: true,
} satisfies RowDecorSpec;
const ACTIONS = [{ id: 'open', label: 'Abrir' }];

const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const vals = [12, 18, 15, 22, 30, 28, 35, 41, 38, 44, 52, 47];
const puntos = Array.from({ length: 14 }, (_, i) => ({ label: `Tipo de atención número ${i + 1} con nombre largo`, value: 120 - i * 7 }));

function Narrow() {
  return (
    <div style={{ width: 400 }}>
      <VcDataTable<R> {...DECOR} caption="Angosta" rows={rows.slice(0, 4)} columns={columns} actions={ACTIONS} pageSize={10} search="Buscar…" />
    </div>
  );
}

function App() {
  const p = new URLSearchParams(location.search);
  const view = p.get('view') || 'table';
  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto', background: 'var(--md-sys-color-background)', color: 'var(--md-sys-color-on-surface)' }}>
      {view === 'table' && (
        <VcDataTable<R> {...DECOR} caption="Expedientes" rows={rows} columns={columns} actions={ACTIONS} pageSize={10} search="Buscar por folio, CURP o nombre…" emptyTitle="Sin expedientes" emptyDescription="Nada." />
      )}
      {view === 'empty' && (
        <VcDataTable<R> {...DECOR} caption="Vacía" rows={[]} columns={columns} pageSize={10} search="Buscar…" emptyTitle="Sin expedientes en esta vista" emptyDescription="Cuando existan aparecerán aquí." />
      )}
      {view === 'narrow' && <Narrow />}
      {view === 'charts' && (
        <div className="@container est-page" style={{ display: 'grid', gap: 16 }}>
          <div className="est-grid">
            <ChartPanel className="est-span-2" title="Atenciones por mes" insight={insightSerie(vals)} summary="x" data={{ columns: ['Mes', 'Atenciones'], rows: meses.map((m, i) => [m, vals[i]]) }}>
              <KitChart label="Atenciones por mes" type="bar" labels={meses} series={[{ name: 'Atenciones', values: vals }]} barWidth={44} />
            </ChartPanel>
            <ChartPanel title="Primera vez y seguimiento" insight="Seguimiento: 62 % de las atenciones" summary="x" data={{ columns: ['Mes'], rows: [] }}>
              <KitChart label="PV" type="bar" stacked labels={meses.slice(0, 6)} series={[{ name: 'Primera vez', values: [5, 8, 6, 9, 12, 10] }, { name: 'Seguimiento', values: [7, 10, 9, 13, 18, 18] }]} />
            </ChartPanel>
            <ChartPanel title="Tendencia" insight="▲ 12 % vs. mes anterior" summary="x" data={{ columns: ['Mes'], rows: [] }}>
              <KitChart label="Tendencia" type="area" labels={meses} series={[{ name: 'Atenciones', values: vals }]} />
            </ChartPanel>
            <ChartPanel title="Atenciones por tipo" insight="Mayor: Tipo 1 · 12 %" summary="x" data={{ columns: ['Tipo', 'Atenciones'], rows: puntos.map((q) => [q.label, q.value]) }}>
              <HBars puntos={puntos} label="tipos" />
            </ChartPanel>
            <ChartPanel title="Vacía" summary="x" data={{ columns: ['Mes'], rows: [] }}>
              <KitChart label="vacia" type="bar" labels={[]} series={[{ name: 'A', values: [] }]} />
            </ChartPanel>
            <ChartPanel title="Spark" summary="x" data={{ columns: ['Mes'], rows: [] }}>
              <div style={{ height: 60 }}><Sparkline values={[1, 3, 2, 5, 4, 8, 6]} label="spark" className="w-full h-full" /></div>
            </ChartPanel>
          </div>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
