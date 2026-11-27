import { useEffect, useRef } from 'react';
import { useTabs } from '@yewdiel21/motion-kit/react';
import { Icon } from './Icon';
import './vc-ui.css';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Con `iconOnly`, el ícono reemplaza al texto (el texto queda como nombre accesible). */
  icon?: string;
}

export interface SegmentedTabsProps<T extends string> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  /** Nombre accesible del grupo de pestañas. */
  label: string;
  iconOnly?: boolean;
}

/** Control segmentado de la barra (cápsula de 36 px): el indicador del kit se desliza entre opciones. */
export function SegmentedTabs<T extends string>({ value, options, onChange, label, iconOnly = false }: SegmentedTabsProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const tabs = useTabs(ref, { onSelect: (index) => onChange(options[index].value) });

  useEffect(() => {
    const index = options.findIndex((option) => option.value === value);
    if (tabs.current && index >= 0 && tabs.current.index !== index) tabs.current.select(index);
  }, [value, options, tabs]);

  return (
    <div ref={ref} className={`mk-segmented vc-segmented ${iconOnly ? 'vc-segmented--icons' : ''}`} role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          data-mk-tab
          aria-selected={option.value === value}
          {...(iconOnly ? { title: option.label, 'aria-label': option.label } : {})}
        >
          {iconOnly && option.icon ? <Icon name={option.icon} className="text-[20px]" /> : option.label}
        </button>
      ))}
      <span data-mk-indicator="" />
    </div>
  );
}
