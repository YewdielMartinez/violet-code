import { Menu } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/menu';
import { Icon } from './Icon';
import { toolbarPillClass } from './Toolbar';

export interface FilterMenuOption {
  value: string;
  label: string;
  icon?: string;
  /** Cantidad de resultados de la opción (se muestra a la derecha). */
  count?: number;
}

interface BaseProps {
  /** Nombre de la píldora y del menú («Estado», «Canal»). */
  label: string;
  icon?: string;
  options: readonly FilterMenuOption[];
}

interface SingleProps extends BaseProps {
  multiple?: false;
  value: string;
  /** Valor «sin filtro»: con él la píldora no se resalta. */
  defaultValue: string;
  onChange: (value: string) => void;
}

interface MultiProps extends BaseProps {
  multiple: true;
  /** Valores seleccionados; vacío = sin filtro. */
  value: readonly string[];
  onChange: (value: string[]) => void;
}

export type ToolbarFilterMenuProps = SingleProps | MultiProps;

/**
 * Píldora de filtro de la barra que abre un menú de motion-kit.
 * Selección única (con valor por defecto) o múltiple (varias opciones, el menú queda abierto).
 */
export function ToolbarFilterMenu(props: ToolbarFilterMenuProps) {
  const { label, icon, options } = props;
  const selected: readonly string[] = props.multiple ? props.value : [props.value];
  const active = props.multiple ? props.value.length > 0 : props.value !== props.defaultValue;

  const chosen = options.filter((o) => selected.includes(o.value));
  const summary = !active ? null : chosen.length === 1 ? chosen[0].label : `${chosen.length} seleccionados`;
  const badge = active && chosen.length === 1 ? chosen[0].count : undefined;

  function onSelect(value: string) {
    if (props.multiple) {
      props.onChange(props.value.includes(value) ? props.value.filter((v) => v !== value) : [...props.value, value]);
    } else {
      props.onChange(value);
    }
  }

  return (
    <Menu.Root onSelect={onSelect} closeOnSelect={!props.multiple} placement="bottom-end">
      <Menu.Trigger
        className={toolbarPillClass(active)}
        aria-label={summary ? `${label}: ${summary}` : label}
        data-active={active || undefined}
      >
        {icon ? <Icon name={icon} className="text-[18px]" /> : null}
        <span>{label}</span>
        {summary ? <span className="hidden max-w-32 truncate text-on-surface-variant sm:inline">· {summary}</span> : null}
        {badge ? (
          <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-xs leading-5 text-on-primary">{badge}</span>
        ) : null}
        <Icon name="expand_more" className="-mr-1 text-[18px]" />
      </Menu.Trigger>
      <Menu.Content className="vc-filter-menu" aria-label={label}>
        <p className="px-4 pt-1.5 pb-2 text-xs font-medium uppercase tracking-wide text-on-surface-variant">{label}</p>
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <Menu.Item
              key={o.value}
              value={o.value}
              role={props.multiple ? 'menuitemcheckbox' : 'menuitemradio'}
              aria-checked={on}
              className={on ? 'font-medium text-primary' : undefined}
            >
              {o.icon ? <Icon name={o.icon} /> : null}
              <span className="min-w-0 flex-1 text-left">{o.label}</span>
              {o.count !== undefined ? <span className="ml-2 font-mono text-xs opacity-75">{o.count}</span> : null}
              <Icon name="check" className={on ? 'text-[18px]' : 'invisible text-[18px]'} />
            </Menu.Item>
          );
        })}
      </Menu.Content>
    </Menu.Root>
  );
}
