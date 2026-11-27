import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from './Icon';

interface ToolbarSearchProps {
  value: string;
  onChange: (value: string) => void;
  /** Nombre accesible y placeholder del campo. */
  label: string;
  placeholder?: string;
}

/**
 * Búsqueda compacta: un botón de lupa que se expande en un campo de 36 px.
 * Escape borra el texto y lo contrae; si hay texto, queda abierto.
 */
export function ToolbarSearch({ value, onChange, label, placeholder }: ToolbarSearchProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const expanded = open || value !== '';

  useEffect(() => {
    if (expanded) {
      if (open) inputRef.current?.focus();
    } else if (restoreFocus.current) {
      restoreFocus.current = false;
      buttonRef.current?.focus();
    }
  }, [expanded, open]);

  function close() {
    restoreFocus.current = true;
    onChange('');
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }

  return (
    <div
      className={`relative flex h-9 shrink-0 items-center overflow-hidden rounded-full bg-surface-container-high transition-[width,background-color] duration-300 ease-out motion-reduce:transition-none ${
        expanded ? 'w-56 sm:w-64' : 'w-9 hover:bg-surface-container-highest'
      }`}
    >
      {!expanded ? (
        <button
          ref={buttonRef}
          type="button"
          aria-label={label}
          title={label}
          aria-expanded={false}
          onClick={() => setOpen(true)}
          className="grid size-9 shrink-0 place-items-center rounded-full text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Icon name="search" className="text-[20px]" />
        </button>
      ) : (
        <>
          <Icon name="search" className="pointer-events-none absolute left-2.5 text-[18px] text-on-surface-variant" />
          <input
            ref={inputRef}
            type="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => {
              if (value === '') setOpen(false);
            }}
            placeholder={placeholder ?? label}
            aria-label={label}
            className="h-9 w-full rounded-full bg-transparent pr-9 pl-9 text-sm text-on-surface placeholder:text-on-surface-variant focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-search-cancel-button]:appearance-none"
          />
          <button
            type="button"
            aria-label="Borrar búsqueda"
            onMouseDown={(e) => e.preventDefault()}
            onClick={close}
            className="absolute right-1 grid size-7 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </>
      )}
    </div>
  );
}
