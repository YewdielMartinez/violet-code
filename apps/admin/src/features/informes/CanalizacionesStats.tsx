import { useCallback, useMemo, useState } from 'react';
import { toast } from '@yewdiel21/motion-kit/react';
import {
  DESTINO_LABELS,
  type DerivacionItem,
  type DestinoDerivacion,
} from '@/domain/models/Derivacion';
import { useDerivaciones } from '@/features/canalizaciones/api';
import { WidgetSizeProvider } from '@/features/dashboard/widgets/box';
import { KpiTile } from '@/features/dashboard/widgets/KpiTile';
import { downloadBlob, toXlsx, type ExportColumn } from '@/shared/export';
import { Icon } from '@/shared/ui/Icon';
import '@/shared/ui/vc-ui.css';
import { assertNoPiiColumns } from './informeExport';

const DESTINO_ORDER: readonly DestinoDerivacion[] = [
  'trabajo_social',
  'psicologia',
  'juridico',
  'fiscalia',
  'refugio',
  'capacitacion',
  'otra_institucion',
];

const DAY_PREFIX_RE = /^(\d{4}-\d{2}-\d{2})/;
const DATE_FMT = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
const pad2 = (n: number) => String(n).padStart(2, '0');

export interface CanalizacionDestinoCount {
  destino: DestinoDerivacion;
  label: string;
  count: number;
}

export interface CanalizacionesResumen {
  totalPersonas: number;
  porDestino: readonly CanalizacionDestinoCount[];
}

export const CANALIZACIONES_EXPORT_COLUMNS: readonly ExportColumn<CanalizacionDestinoCount>[] = [
  { key: 'destino', header: 'Destino', value: (r) => r.label },
  { key: 'personas', header: 'Personas canalizadas', value: (r) => r.count },
];

/** Devuelve el rango completo (`YYYY-MM-DD`) del mes al que pertenece `now`. */
export function rangoMesActual(now: Date): { desde: string; hasta: string } {
  const anio = now.getFullYear();
  const mes = now.getMonth() + 1;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  return {
    desde: `${anio}-${pad2(mes)}-01`,
    hasta: `${anio}-${pad2(mes)}-${pad2(ultimoDia)}`,
  };
}

/** `canalizaciones-2026-03-01_a_2026-03-31.xlsx` o equivalente según los límites activos. */
export function canalizacionesFileName(desde: string, hasta: string): string {
  if (desde && hasta) return `canalizaciones-${desde}_a_${hasta}.xlsx`;
  if (desde) return `canalizaciones-desde-${desde}.xlsx`;
  if (hasta) return `canalizaciones-hasta-${hasta}.xlsx`;
  return 'canalizaciones-todas.xlsx';
}

function formatDay(day: string): string {
  // Mediodía local: evita que el día cambie según el huso horario del navegador.
  return DATE_FMT.format(new Date(`${day}T12:00:00`)).replace(/\./g, '');
}

function formatRangoSubtitle(desde: string, hasta: string): string {
  if (desde && hasta) return `${formatDay(desde)} – ${formatDay(hasta)}`;
  if (desde) return `Desde ${formatDay(desde)}`;
  if (hasta) return `Hasta ${formatDay(hasta)}`;
  return 'Todas las fechas';
}

/**
 * Resume personas canalizadas distintas (`fichaId`) dentro del rango `[desde, hasta]` (`YYYY-MM-DD`),
 * excluyendo las canceladas. No lee ni expone datos identificables (`usuariaNombre`, `folio`).
 */
export function resumirCanalizacionesPorRango(
  items: readonly DerivacionItem[],
  desde: string,
  hasta: string,
): CanalizacionesResumen {
  const personasTotales = new Set<string>();
  const personasPorDestino = new Map<DestinoDerivacion, Set<string>>();
  for (const destino of DESTINO_ORDER) {
    personasPorDestino.set(destino, new Set());
  }

  for (const item of items) {
    if (item.estado === 'cancelada') continue;
    const day = DAY_PREFIX_RE.exec(item.fechaDerivacion)?.[1];
    if (!day) continue;
    if (desde && day < desde) continue;
    if (hasta && day > hasta) continue;

    personasTotales.add(item.fichaId);
    personasPorDestino.get(item.destino)?.add(item.fichaId);
  }

  return {
    totalPersonas: personasTotales.size,
    porDestino: DESTINO_ORDER.map((destino) => ({
      destino,
      label: DESTINO_LABELS[destino],
      count: personasPorDestino.get(destino)?.size ?? 0,
    })),
  };
}

export interface CanalizacionesStatsProps {
  /** Fecha de referencia para inicializar el mes en curso; útil en pruebas. */
  now?: Date;
}

/** Tarjeta de canalizaciones por destino con selector de rango de fechas y exportación CSV/Excel (sin PII). */
export function CanalizacionesStats({ now }: CanalizacionesStatsProps) {
  const [rango, setRango] = useState(() => rangoMesActual(now ?? new Date()));
  const { desde, hasta } = rango;

  const q = useDerivaciones();

  const resumen = useMemo(
    () => resumirCanalizacionesPorRango(q.data ?? [], desde, hasta),
    [q.data, desde, hasta],
  );

  const subtitle = useMemo(() => formatRangoSubtitle(desde, hasta), [desde, hasta]);
  const sinDatos = q.isLoading || q.isError || !q.data || resumen.totalPersonas === 0;

  const exportar = useCallback(() => {
    const fileName = canalizacionesFileName(desde, hasta);
    try {
      assertNoPiiColumns(CANALIZACIONES_EXPORT_COLUMNS);
      const blob = toXlsx(resumen.porDestino, CANALIZACIONES_EXPORT_COLUMNS, 'Canalizaciones');
      downloadBlob(blob, fileName);
      toast(`Se descargó ${fileName}.`, { tone: 'success' });
    } catch {
      toast('No se pudo generar el archivo de canalizaciones.', { tone: 'error' });
    }
  }, [desde, hasta, resumen.porDestino]);

  return (
    <section
      aria-label="Canalizaciones"
      className="@container flex min-h-0 flex-col gap-4 overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-lowest p-4 @sm:p-5"
    >
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary-container text-on-secondary-container"
          >
            <Icon name="swap_horiz" className="text-[18px]" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base leading-tight font-medium text-on-surface">Canalizaciones</h2>
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

      <div className="flex flex-wrap items-end gap-3">
        <label className="vc-daterange__field">
          Desde
          <input
            type="date"
            className="vc-daterange__input"
            value={desde}
            max={hasta || undefined}
            onChange={(e) => setRango((prev) => ({ ...prev, desde: e.target.value }))}
          />
        </label>
        <label className="vc-daterange__field">
          Hasta
          <input
            type="date"
            className="vc-daterange__input"
            value={hasta}
            min={desde || undefined}
            onChange={(e) => setRango((prev) => ({ ...prev, hasta: e.target.value }))}
          />
        </label>
        {desde || hasta ? (
          <button
            type="button"
            className="mk-button mk-button--text vc-press"
            onClick={() => setRango({ desde: '', hasta: '' })}
          >
            Limpiar fechas
          </button>
        ) : null}
      </div>

      <div className="min-h-[220px]">
        <WidgetSizeProvider value="l">
          <KpiTile
            value={q.data ? resumen.totalPersonas : undefined}
            loading={q.isLoading}
            error={q.isError}
            onRetry={() => void q.refetch()}
            secondary={resumen.totalPersonas === 1 ? 'persona canalizada' : 'personas canalizadas'}
            detailsTitle="Personas canalizadas por destino"
            details={
              q.data
                ? resumen.porDestino.map((d) => ({
                    label: d.label,
                    value: d.count,
                  }))
                : undefined
            }
          />
        </WidgetSizeProvider>
      </div>
    </section>
  );
}
