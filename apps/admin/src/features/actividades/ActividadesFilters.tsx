import { useEffect, useRef } from 'react';
import { useTabs } from '@yewdiel21/motion-kit/react';
import { TIPO_INSTITUCION_LABELS, type TipoInstitucionActividad } from '@/domain/models/ActividadPreventiva';
import { Icon } from '@/shared/ui/Icon';
import { TIPO_INSTITUCION_ICON } from './ActividadChips';
import { FILTROS_INICIALES, type ActividadListFilters, type ActividadTab } from './actividadesList';

const TABS = [
  { value: 'pendientes', label: 'Pendientes' },
  { value: 'realizadas', label: 'Realizadas' },
  { value: 'todas', label: 'Todas' },
] as const satisfies readonly { value: ActividadTab; label: string }[];

const TIPOS = Object.keys(TIPO_INSTITUCION_LABELS) as TipoInstitucionActividad[];

/** Control segmentado Pendientes / Realizadas / Todas: el indicador del kit se desliza. */
function ActividadTabs({ value, onChange }: { value: ActividadTab; onChange: (tab: ActividadTab) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const tabs = useTabs(ref, { onSelect: (index) => onChange(TABS[index].value) });

  useEffect(() => {
    const index = TABS.findIndex((tab) => tab.value === value);
    if (tabs.current && index >= 0 && tabs.current.index !== index) tabs.current.select(index);
  }, [value, tabs]);

  return (
    <div ref={ref} className="mk-segmented act-tabs" role="tablist" aria-label="Estado de las actividades">
      {TABS.map((tab) => (
        <button key={tab.value} type="button" role="tab" data-mk-tab aria-selected={tab.value === value}>
          {tab.label}
        </button>
      ))}
      <span data-mk-indicator="" />
    </div>
  );
}

export interface ActividadesFiltersProps {
  filtros: ActividadListFilters;
  onChange: (patch: Partial<ActividadListFilters>) => void;
}

/** Barra de filtros: estado (pestañas), búsqueda por institución o lugar, tipo de institución y rango de fechas. */
export function ActividadesFilters({ filtros, onChange }: ActividadesFiltersProps) {
  const hayFiltros =
    filtros.busqueda !== '' || filtros.tipoInstitucion !== '' || filtros.desde !== '' || filtros.hasta !== '';

  return (
    <section className="act-filters" aria-label="Filtros de actividades">
      <div className="act-filters__row">
        <ActividadTabs value={filtros.tab} onChange={(tab) => onChange({ tab })} />

        <label className="mk-field act-search">
          <Icon name="search" className="text-[20px] text-on-surface-variant" />
          <input
            type="search"
            aria-label="Buscar por institución o lugar"
            placeholder="Buscar escuela, empresa, lugar o colonia…"
            autoComplete="off"
            value={filtros.busqueda}
            onChange={(e) => onChange({ busqueda: e.target.value })}
          />
        </label>

        <div className="act-dates">
          <label className="act-date">
            <span>Desde</span>
            <input
              type="date"
              aria-label="Desde"
              value={filtros.desde}
              max={filtros.hasta || undefined}
              onChange={(e) => onChange({ desde: e.target.value })}
            />
          </label>
          <label className="act-date">
            <span>Hasta</span>
            <input
              type="date"
              aria-label="Hasta"
              value={filtros.hasta}
              min={filtros.desde || undefined}
              onChange={(e) => onChange({ hasta: e.target.value })}
            />
          </label>
        </div>

        {hayFiltros ? (
          <button
            type="button"
            className="act-clear act-btn"
            onClick={() => onChange({ ...FILTROS_INICIALES, tab: filtros.tab })}
          >
            <Icon name="filter_alt_off" className="text-[18px]" />
            Limpiar
          </button>
        ) : null}
      </div>

      <div role="group" aria-label="Tipo de institución" className="act-filters__chips">
        <button
          type="button"
          aria-pressed={filtros.tipoInstitucion === ''}
          onClick={() => onChange({ tipoInstitucion: '' })}
          className={`mk-chip mk-chip--filter act-btn ${filtros.tipoInstitucion === '' ? 'bg-secondary-container text-on-secondary-container' : ''}`}
        >
          Todas las instituciones
        </button>
        {TIPOS.map((tipo) => (
          <button
            key={tipo}
            type="button"
            aria-pressed={filtros.tipoInstitucion === tipo}
            onClick={() => onChange({ tipoInstitucion: filtros.tipoInstitucion === tipo ? '' : tipo })}
            className={`mk-chip mk-chip--filter act-btn ${filtros.tipoInstitucion === tipo ? 'bg-secondary-container text-on-secondary-container' : ''}`}
          >
            <Icon name={TIPO_INSTITUCION_ICON[tipo]} className="text-[16px]" />
            {TIPO_INSTITUCION_LABELS[tipo]}
          </button>
        ))}
      </div>
    </section>
  );
}
