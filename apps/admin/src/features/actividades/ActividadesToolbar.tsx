import { TIPO_INSTITUCION_LABELS, type TipoInstitucionActividad } from '@/domain/models/ActividadPreventiva';
import { ToolbarIconButton, ToolbarPrimaryButton } from '@/shared/ui/Toolbar';
import { ToolbarDateRange } from '@/shared/ui/ToolbarDateRange';
import { ToolbarFilterMenu, type FilterMenuOption } from '@/shared/ui/ToolbarFilterMenu';
import { TIPO_INSTITUCION_ICON } from './ActividadChips';
import { FILTROS_INICIALES, hayFiltrosActivos, type ActividadListFilters, type ActividadTab } from './actividadesList';

const ESTADO_OPTIONS: readonly FilterMenuOption[] = [
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
  onCrear?: () => void;
}

/**
 * Acciones de `PageHeader` (mismo patrón que Expedientes y Usuarios): píldora «Estado» (filtro del servidor),
 * institución, fechas y, al final, la acción primaria. La búsqueda va dentro de la tabla (`DataTable`).
 * Devuelve un fragmento: el contenedor flex lo pone `PageHeader`.
 */
export function ActividadesToolbar({ filtros, onChange, onCrear }: ActividadesToolbarProps) {
  return (
    <>
      <ToolbarFilterMenu
        label="Estado"
        icon="filter_list"
        options={ESTADO_OPTIONS}
        value={filtros.tab}
        defaultValue="todas"
        onChange={(value) => onChange({ tab: value as ActividadTab })}
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
      {onCrear ? (
        <ToolbarPrimaryButton label="Nueva actividad" icon="event_available" showLabel onClick={onCrear} />
      ) : null}
    </>
  );
}
