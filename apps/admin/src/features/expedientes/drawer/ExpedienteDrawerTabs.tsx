import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useTabs } from '@yewdiel21/motion-kit/react';
import { Icon } from '@/shared/ui/Icon';

export type DrawerTab = 'resumen' | 'agresor' | 'documentos' | 'canalizaciones' | 'ordenes' | 'seguimiento' | 'notas';

interface TabDefinition {
  id: DrawerTab;
  label: string;
  icon: string;
  sensitive: boolean;
}

const ALL_TABS: readonly TabDefinition[] = [
  { id: 'resumen', label: 'Datos', icon: 'badge', sensitive: false },
  { id: 'agresor', label: 'Persona agresora', icon: 'shield_person', sensitive: true },
  { id: 'documentos', label: 'Documentos', icon: 'folder_open', sensitive: true },
  { id: 'canalizaciones', label: 'Canalizaciones', icon: 'alt_route', sensitive: true },
  { id: 'ordenes', label: 'Órdenes', icon: 'gavel', sensitive: true },
  // Dirección también las ve (es parte del acceso sensible); el panel de notas le explica que no aplica.
  { id: 'seguimiento', label: 'Seguimiento', icon: 'timeline', sensitive: true },
  { id: 'notas', label: 'Notas privadas', icon: 'lock', sensitive: true },
];

interface Props {
  activeTab: DrawerTab;
  canAccessSensitiveTabs: boolean;
  onChange: (next: DrawerTab) => void;
  onTabIntent?: (tab: DrawerTab) => void;
}

/** Pestañas tipo pill chip con indicador deslizante animado mediante `useTabs` de motion-kit. */
export const ExpedienteDrawerTabs = memo(function ExpedienteDrawerTabs({
  activeTab,
  canAccessSensitiveTabs,
  onChange,
  onTabIntent,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  const visibleTabs = useMemo(
    () => ALL_TABS.filter((tab) => !tab.sensitive || canAccessSensitiveTabs),
    [canAccessSensitiveTabs],
  );

  const onChangeRef = useRef(onChange);
  const visibleTabsRef = useRef(visibleTabs);
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
    visibleTabsRef.current = visibleTabs;
  }, [onChange, visibleTabs]);

  const tabs = useTabs(
    listRef,
    {
      onSelect: (index) => {
        const target = visibleTabsRef.current[index];
        if (target) onChangeRef.current(target.id);
      },
    },
    [visibleTabs.length],
  );

  const activeIndex = Math.max(
    0,
    visibleTabs.findIndex((tab) => tab.id === activeTab),
  );

  useEffect(() => {
    if (tabs.current && tabs.current.index !== activeIndex) {
      tabs.current.select(activeIndex);
    }
  }, [activeIndex, tabs]);

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Secciones del expediente"
      className="vc-drawer-tabs"
    >
      {visibleTabs.map((tab) => {
        const selected = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-mk-tab=""
            aria-selected={selected}
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
      <span data-mk-indicator="" aria-hidden className="vc-drawer-tabs__indicator" />
    </div>
  );
});
