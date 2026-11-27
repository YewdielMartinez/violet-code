import { useMemo } from 'react';
import { Select } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/select';
import '@yewdiel21/motion-kit/css/components/menu';
import type { AreaOption } from '@/domain/models/Reporte';
import { Icon } from '@/shared/ui/Icon';
import { SegmentedTabs, type SegmentedOption } from '@/shared/ui/SegmentedTabs';
import { MESES, rangoValido, type Periodo, type PeriodoModo } from './reportes/periodo';
import './informes.css';

const MODO_OPTIONS: readonly SegmentedOption<PeriodoModo>[] = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'anual', label: 'Anual' },
  { value: 'rango', label: 'Rango' },
];

const MES_OPTIONS = MESES.map((label, i) => ({ value: String(i + 1), label }));

/** Años seleccionables: el actual y los dos anteriores. */
export function yearOptions(current: number) {
  return [current, current - 1, current - 2].map((y) => ({ value: String(y), label: String(y) }));
}

const TODAS = 'todas';

export type AreaControl =
  | {
      /** Dirección: puede elegir «Todas las áreas» o una. */
      modo: 'seleccion';
      value: number | null;
      areas: readonly AreaOption[];
      onChange: (areaId: number | null) => void;
      /** Reportes que no se dividen por área (actividades, alertas): el selector no aplica. */
      deshabilitado?: boolean;
    }
  | {
      /** Áreas de atención: fija en la suya, sin selector. */
      modo: 'fija';
      nombre: string;
    };

export interface EstadisticasToolbarProps {
  periodo: Periodo;
  onPeriodo: (periodo: Periodo) => void;
  /** Año actual (para ofrecer él y los dos anteriores). */
  anioActual: number;
  area: AreaControl;
}

/**
 * Barra de filtros de Estadísticas: periodo (Mensual / Anual / Rango), año, mes o fechas, y área. Dirección elige el
 * área («Todas las áreas» o una); Trabajo Social, Psicología y Jurídico quedan fijas en la suya.
 */
export function EstadisticasToolbar({ periodo, onPeriodo, anioActual, area }: EstadisticasToolbarProps) {
  const years = useMemo(() => yearOptions(anioActual), [anioActual]);
  const areaOptions = useMemo(
    () =>
      area.modo === 'seleccion'
        ? [{ value: TODAS, label: 'Todas las áreas' }, ...area.areas.map((a) => ({ value: String(a.id), label: a.nombre }))]
        : [],
    [area],
  );
  const rangoOk = rangoValido(periodo);

  return (
    <div className="est-toolbar" role="group" aria-label="Filtros de estadísticas">
      <SegmentedTabs
        label="Periodo"
        options={MODO_OPTIONS}
        value={periodo.modo}
        onChange={(modo) => onPeriodo({ ...periodo, modo })}
      />

      {periodo.modo !== 'rango' ? (
        <div className="est-toolbar__field w-28">
          <Select
            size="sm"
            label="Año"
            options={years}
            value={String(periodo.anio)}
            onChange={(value) => onPeriodo({ ...periodo, anio: Number(value) })}
          />
        </div>
      ) : null}

      {periodo.modo === 'mensual' ? (
        <div className="est-toolbar__field w-40">
          <Select
            size="sm"
            label="Mes"
            options={MES_OPTIONS}
            value={String(periodo.mes)}
            onChange={(value) => onPeriodo({ ...periodo, mes: Number(value) })}
          />
        </div>
      ) : null}

      {periodo.modo === 'rango' ? (
        <>
          <label className="est-date">
            <span>Desde</span>
            <input
              type="date"
              className="vc-daterange__input"
              value={periodo.desde}
              max={periodo.hasta || undefined}
              onChange={(e) => onPeriodo({ ...periodo, desde: e.target.value })}
            />
          </label>
          <label className="est-date">
            <span>Hasta</span>
            <input
              type="date"
              className="vc-daterange__input"
              value={periodo.hasta}
              min={periodo.desde || undefined}
              onChange={(e) => onPeriodo({ ...periodo, hasta: e.target.value })}
            />
          </label>
        </>
      ) : null}

      {area.modo === 'seleccion' ? (
        <div className="est-toolbar__field w-48">
          <Select
            size="sm"
            label="Área"
            options={areaOptions}
            value={area.value === null ? TODAS : String(area.value)}
            disabled={area.deshabilitado}
            onChange={(value) => area.onChange(value === TODAS ? null : Number(value))}
          />
        </div>
      ) : (
        <p className="est-area-fija" aria-label={`Área: ${area.nombre}`} title="Tu rol solo consulta su propia área">
          <Icon name="lock" className="text-[16px]" />
          <span>{area.nombre}</span>
        </p>
      )}

      {periodo.modo === 'rango' && !rangoOk ? (
        <p className="est-toolbar__hint" role="alert">
          Elige las dos fechas (desde no puede ser después de hasta, y el rango no puede pasar de 5 años).
        </p>
      ) : null}
    </div>
  );
}
