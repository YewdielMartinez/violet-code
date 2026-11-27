import { memo, useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { useTabs } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/recipes/tabs';
import { Icon } from '@/shared/ui/Icon';
import type { DrawerTab } from './ExpedienteDrawerTabs';

export interface DetailTabItem {
  id: DrawerTab;
  label: string;
  icon: string;
}

interface Props {
  tabs: readonly DetailTabItem[];
  activeTab: DrawerTab;
  onChange: (next: DrawerTab) => void;
  onTabIntent?: (tab: DrawerTab) => void;
}

/**
 * Pestañas del detalle de expediente.
 * - El indicador deslizante lo mueve `useTabs` de motion-kit (GSAP, respeta prefers-reduced-motion,
 *   se reubica con ResizeObserver y centra la pestaña activa si la lista desborda).
 * - El estado (URL, panel activo) sigue en React: `useTabs` solo gobierna el indicador y se mantiene
 *   sincronizado cuando la pestaña cambia por teclado, URL o enlace profundo.
 */
export const ExpedienteDetailTabs = memo(function ExpedienteDetailTabs({
  tabs,
  activeTab,
  onChange,
  onTabIntent,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  // El motor lee los botones al crearse: se recrea solo si cambia el conjunto de pestañas.
  const tabsKey = useMemo(() => tabs.map((tab) => tab.id).join('|'), [tabs]);
  const engine = useTabs(listRef, undefined, [tabsKey]);

  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeTab),
  );

  const prevIndexRef = useRef<number | null>(null);
  useEffect(() => {
    const instance = engine.current;
    if (instance && instance.index !== activeIndex) instance.select(activeIndex);
    // El «salto» del ícono activo solo corre tras la primera interacción, no al pintar la página.
    if (prevIndexRef.current !== null && prevIndexRef.current !== activeIndex) {
      listRef.current?.setAttribute('data-tab-animated', '');
    }
    prevIndexRef.current = activeIndex;
  }, [engine, activeIndex, tabsKey]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let nextIndex: number;
    if (event.key === 'ArrowRight') nextIndex = (activeIndex + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (activeIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    const target = tabs[nextIndex];
    if (!target) return;
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
    onChange(target.id);
  }

  return (
    <div className="vc-detail-tabs-shell">
      <div
        ref={listRef}
        data-mk="tabs"
        role="tablist"
        aria-orientation="horizontal"
        aria-label="Secciones del expediente"
        onKeyDown={handleKeyDown}
        className="vc-detail-tabs"
      >
        <span data-mk-indicator="" aria-hidden className="vc-detail-tabs__indicator" />
        {tabs.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              data-mk-tab
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onPointerEnter={() => onTabIntent?.(tab.id)}
              onFocus={() => onTabIntent?.(tab.id)}
              onClick={() => onChange(tab.id)}
              className="vc-detail-tabs__tab"
            >
              <Icon name={tab.icon} className="vc-detail-tabs__icon text-[20px]" filled={selected} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
