import { Menu } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/menu';
import { Icon } from '@/shared/ui/Icon';
import { toolbarPillClass } from '@/shared/ui/Toolbar';
import { QUICK_FILTERS, type EstadoFilter } from './canalizacionesTableConfig';

interface Props {
  value: EstadoFilter;
  counts: Record<EstadoFilter, number>;
  onChange: (next: EstadoFilter) => void;
}

/** Filtro por estado: «Estado ▾» con menú de motion-kit y conteos por opción. */
export function CanalizacionEstadoMenu({ value, counts, onChange }: Props) {
  const active = value !== 'todos';
  const current = QUICK_FILTERS.find((f) => f.id === value);

  return (
    <Menu.Root onSelect={(next) => onChange(next as EstadoFilter)}>
      <Menu.Trigger className={toolbarPillClass(active)} aria-label="Filtrar por estado">
        <Icon name="filter_list" className="text-[18px]" />
        <span>{active && current ? `Estado: ${current.label}` : 'Estado'}</span>
        <Icon name="arrow_drop_down" className="-mr-1 text-[20px]" />
      </Menu.Trigger>
      <Menu.Content className="vc-filter-menu" aria-label="Estado de la canalización">
        {QUICK_FILTERS.map((f) => (
          <Menu.Item key={f.id} value={f.id} aria-current={f.id === value ? 'true' : undefined}>
            <Icon name={f.id === value ? 'check' : 'chevron_right'} className={f.id === value ? '' : 'opacity-0'} />
            <span className="flex-1">{f.label}</span>
            <span className="ml-3 font-mono text-xs opacity-75">{counts[f.id]}</span>
          </Menu.Item>
        ))}
      </Menu.Content>
    </Menu.Root>
  );
}
