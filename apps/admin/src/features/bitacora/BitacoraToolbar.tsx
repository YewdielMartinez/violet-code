import { useMemo } from 'react';
import { Menu } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/menu';
import {
  ACCIONES_BITACORA,
  accionBitacoraLabel,
  tablaBitacoraLabel,
  type AccionBitacora,
  type BitacoraOpcionesFiltro,
} from '@/domain/models/Bitacora';
import { Icon } from '@/shared/ui/Icon';
import { ToolbarIconButton, toolbarPillClass } from '@/shared/ui/Toolbar';
import { ToolbarDateRange } from '@/shared/ui/ToolbarDateRange';
import { ToolbarFilterMenu, type FilterMenuOption } from '@/shared/ui/ToolbarFilterMenu';
import { FILTROS_INICIALES, hayFiltrosActivos, type BitacoraListFilters } from './bitacoraList';
import type { BitacoraExportFormato } from './bitacoraExport';

const TODAS = '';
// El menú de motion-kit no admite valores vacíos: «sin filtro» se representa con un valor reservado.
const TODAS_VALUE = '__todas__';

export interface BitacoraToolbarProps {
  filtros: BitacoraListFilters;
  opciones: BitacoraOpcionesFiltro | undefined;
  onChange: (patch: Partial<BitacoraListFilters>) => void;
  /** Con valor, muestra «Descargar» (CSV / Excel). */
  onDescargar?: (formato: BitacoraExportFormato) => void;
  descargando?: boolean;
  /** Sin eventos que descargar: el menú se deshabilita. */
  sinDatos?: boolean;
}

/**
 * Acciones de `PageHeader` (mismo patrón que Expedientes, Usuarios y Actividades): píldoras «Tabla» y «Acción»
 * (filtros del servidor), fechas, limpiar filtros y descarga. Devuelve un fragmento: el contenedor flex lo pone
 * `PageHeader`.
 */
export function BitacoraToolbar({ filtros, opciones, onChange, onDescargar, descargando, sinDatos }: BitacoraToolbarProps) {
  const tablaOptions = useMemo<FilterMenuOption[]>(() => {
    const tablas = new Set(opciones?.tablas ?? []);
    // Si hay una tabla elegida que ya no está en la lista, se conserva para que el filtro siga visible.
    if (filtros.tabla) tablas.add(filtros.tabla);
    const ordenadas = [...tablas].sort((a, b) => tablaBitacoraLabel(a).localeCompare(tablaBitacoraLabel(b), 'es-MX'));
    return [
      { value: TODAS_VALUE, label: 'Todas las tablas' },
      ...ordenadas.map((tabla) => ({ value: tabla, label: tablaBitacoraLabel(tabla) })),
    ];
  }, [opciones?.tablas, filtros.tabla]);

  const accionOptions = useMemo<FilterMenuOption[]>(
    () => [
      { value: TODAS_VALUE, label: 'Todas las acciones' },
      ...(opciones?.acciones ?? ACCIONES_BITACORA).map((accion) => ({ value: accion, label: accionBitacoraLabel(accion) })),
    ],
    [opciones?.acciones],
  );

  return (
    <>
      <ToolbarFilterMenu
        label="Tabla"
        icon="filter_list"
        options={tablaOptions}
        value={filtros.tabla || TODAS_VALUE}
        defaultValue={TODAS_VALUE}
        onChange={(value) => onChange({ tabla: value === TODAS_VALUE ? TODAS : value })}
      />
      <ToolbarFilterMenu
        label="Acción"
        icon="policy"
        options={accionOptions}
        value={filtros.accion || TODAS_VALUE}
        defaultValue={TODAS_VALUE}
        onChange={(value) => onChange({ accion: value === TODAS_VALUE ? '' : (value as AccionBitacora) })}
      />
      <ToolbarDateRange desde={filtros.desde} hasta={filtros.hasta} onChange={onChange} />
      {hayFiltrosActivos(filtros) ? (
        <ToolbarIconButton icon="filter_alt_off" label="Limpiar filtros" onClick={() => onChange({ ...FILTROS_INICIALES })} />
      ) : null}
      {onDescargar ? (
        <Menu.Root onSelect={(value) => onDescargar(value as BitacoraExportFormato)} placement="bottom-end">
          <Menu.Trigger
            className={toolbarPillClass(false)}
            aria-label="Descargar"
            disabled={descargando || sinDatos}
            aria-busy={descargando || undefined}
          >
            <Icon name="download" className="text-[18px]" />
            <span>{descargando ? 'Preparando…' : 'Descargar'}</span>
            <Icon name="expand_more" className="-mr-1 text-[18px]" />
          </Menu.Trigger>
          <Menu.Content className="vc-filter-menu" aria-label="Descargar">
            <Menu.Item value="csv">
              <Icon name="description" />
              <span className="min-w-0 flex-1 text-left">CSV</span>
            </Menu.Item>
            <Menu.Item value="xlsx">
              <Icon name="description" />
              <span className="min-w-0 flex-1 text-left">Excel (.xlsx)</span>
            </Menu.Item>
          </Menu.Content>
        </Menu.Root>
      ) : null}
    </>
  );
}
