import { TIPO_INSTITUCION_LABELS, type TipoInstitucionActividad } from '@/domain/models/ActividadPreventiva';
import { SegmentedTabs, type SegmentedOption } from '@/shared/ui/SegmentedTabs';
import { ToolbarIconButton, ToolbarPrimaryButton } from '@/shared/ui/Toolbar';
import { ToolbarDateRange } from '@/shared/ui/ToolbarDateRange';
import { ToolbarFilterMenu, type FilterMenuOption } from '@/shared/ui/ToolbarFilterMenu';
import { ToolbarSearch } from '@/shared/ui/ToolbarSearch';
import { TIPO_INSTITUCION_ICON } from './ActividadChips';
import { FILTROS_INICIALES, hayFiltrosActivos, type ActividadListFilters, type ActividadTab } from './actividadesList';

const TABS: readonly SegmentedOption<ActividadTab>[] = [
  { value: 'pendientes', label: 'Pendientes' },
  { value: 'realizadas', label: 'Realizadas' },
  { value: 'canceladas', label: 'Canceladas' },
  { value: 'todas', label: 'Todas' },
];

const TODAS_INSTITUCIONES = 'todas';

const INSTITUCION_OPTIONS: readonly FilterMenuOption[] = [
  { value: TODAS_INSTITUCIONES, label: 'Todas las instituciones' },
  ...(Object.keys(TIPO_INSTITUCION_LABELS) as TipoInstitucionActividad[]).map((tipo) => ({
    value: tipo,
    label: TIPO_INSTITUCION_LABELS[tipo],
    icon: TIPO_INSTITUCION_ICON[tipo],
  })),
];

export interface ActividadesToolbarProps {
  filtros: ActividadListFilters;
  onChange: (patch: Partial<ActividadListFilters>) => void;
  /** Con valor, muestra el botón primario «Nueva actividad» (`actividad.registrar`). */
  onCrear?: (anchor: HTMLElement) => void;
}

/**
 * Barra de la pantalla (mismo patrón que la Agenda): a la derecha del título, controles compactos de 36 px en una
 * fila — pestañas de estado, búsqueda, institución, fechas y la acción primaria.
 */
export function ActividadesToolbar({ filtros, onChange, onCrear }: ActividadesToolbarProps) {
  return (
    <div className="vc-toolbar">
      <SegmentedTabs label="Estado de las actividades" options={TABS} value={filtros.tab} onChange={(tab) => onChange({ tab })} />
      <ToolbarSearch
        label="Buscar por institución o lugar"
        placeholder="Buscar escuela, empresa, lugar o colonia…"
        value={filtros.busqueda}
        onChange={(busqueda) => onChange({ busqueda })}
      />
      <ToolbarFilterMenu
        label="Institución"
        icon="school"
        options={INSTITUCION_OPTIONS}
        value={filtros.tipoInstitucion || TODAS_INSTITUCIONES}
        defaultValue={TODAS_INSTITUCIONES}
        onChange={(value) =>
          onChange({ tipoInstitucion: value === TODAS_INSTITUCIONES ? '' : (value as TipoInstitucionActividad) })
        }
      />
      <ToolbarDateRange desde={filtros.desde} hasta={filtros.hasta} onChange={onChange} />
      {hayFiltrosActivos(filtros) ? (
        <ToolbarIconButton
          icon="filter_alt_off"
          label="Limpiar filtros"
          onClick={() => onChange({ ...FILTROS_INICIALES, tab: filtros.tab })}
        />
      ) : null}
      {onCrear ? <ToolbarPrimaryButton label="Nueva actividad" showLabel onClick={(event) => onCrear(event.currentTarget)} /> : null}
    </div>
  );
}
