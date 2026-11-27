import { memo, useMemo, useRef, type KeyboardEvent } from 'react';
import { Icon } from '@/shared/ui/Icon';

export type DrawerTab =
  | 'resumen'
  | 'agresor'
  | 'documentos'
  | 'canalizaciones'
  | 'ordenes'
  | 'seguimiento'
  | 'notas'
  | 'historial';

interface TabDefinition {
  id: DrawerTab;
  label: string;
  icon: string;
  sensitive: boolean;
  historialOnly?: boolean;
  /** Notas de TS/Jurídico (Psicología las ve dentro del Historial clínico). */
  notasOnly?: boolean;
}

const ALL_TABS: readonly TabDefinition[] = [
  { id: 'resumen', label: 'Datos', icon: 'badge', sensitive: false },
  { id: 'agresor', label: 'Persona agresora', icon: 'shield_person', sensitive: true },
  { id: 'documentos', label: 'Documentos', icon: 'folder_open', sensitive: true },
  { id: 'canalizaciones', label: 'Canalizaciones', icon: 'alt_route', sensitive: true },
  { id: 'ordenes', label: 'Órdenes de Protección', icon: 'gavel', sensitive: true },
  { id: 'seguimiento', label: 'Seguimiento', icon: 'history', sensitive: true },
  { id: 'notas', label: 'Notas privadas', icon: 'lock', sensitive: true, notasOnly: true },
  {
    id: 'historial',
    label: 'Historial clínico',
    icon: 'psychology',
    sensitive: true,
    historialOnly: true,
  },
];

interface Props {
  activeTab: DrawerTab;
  canAccessSensitiveTabs: boolean;
  canAccessHistorial?: boolean;
  canAccessNotas?: boolean;
  onChange: (next: DrawerTab) => void;
  onTabIntent?: (tab: DrawerTab) => void;
}

/** Pestañas tipo pill chip con navegación accesible por teclado y transición CSS sin reflow. */
export const ExpedienteDrawerTabs = memo(function ExpedienteDrawerTabs({
  activeTab,
  canAccessSensitiveTabs,
  canAccessHistorial = false,
  canAccessNotas = true,
  onChange,
  onTabIntent,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  const visibleTabs = useMemo(
    () =>
      ALL_TABS.filter((tab) => {
        if (tab.historialOnly) return canAccessHistorial;
        if (tab.notasOnly) return canAccessSensitiveTabs && canAccessNotas;
        return !tab.sensitive || canAccessSensitiveTabs;
      }),
    [canAccessSensitiveTabs, canAccessHistorial, canAccessNotas],
  );

  const activeIndex = Math.max(
    0,
    visibleTabs.findIndex((tab) => tab.id === activeTab),
  );

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let nextIndex = -1;
    if (event.key === 'ArrowRight') nextIndex = (activeIndex + 1) % visibleTabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (activeIndex - 1 + visibleTabs.length) % visibleTabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = visibleTabs.length - 1;
    else return;

    event.preventDefault();
    const target = visibleTabs[nextIndex];
    if (!target) return;
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[nextIndex]?.focus();
    onChange(target.id);
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Secciones del expediente"
      className="vc-drawer-tabs"
      onKeyDown={handleKeyDown}
    >
      {visibleTabs.map((tab) => {
        const selected = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onPointerEnter={() => onTabIntent?.(tab.id)}
            onFocus={() => onTabIntent?.(tab.id)}
            onClick={() => onChange(tab.id)}
            className="vc-drawer-tabs__tab"
          >
            <Icon name={tab.icon} className="text-[18px]" filled={selected} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
});
