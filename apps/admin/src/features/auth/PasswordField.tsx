import { useId, useState } from 'react';
import { Icon } from '@/shared/ui/Icon';

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
  /** Etiqueta visible (por defecto «Contraseña», la del login). */
  label?: string;
  name?: string;
  autoComplete?: string;
  placeholder?: string;
  /** Atributos `data-*` extra en el contenedor (p. ej. `data-usuario-field` para enfocar el campo inválido). */
  dataAttrs?: Record<`data-${string}`, string>;
}

/** Campo de contraseña de motion-kit (.mk-field) con el botón de ver/ocultar DENTRO del campo. */
export function PasswordField({
  value,
  onChange,
  invalid,
  describedBy,
  label = 'Contraseña',
  name = 'password',
  autoComplete = 'current-password',
  placeholder,
  dataAttrs,
}: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className="mk-field" {...dataAttrs}>
      <label htmlFor={id} className="mk-field__label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          name={name}
          autoComplete={autoComplete}
          required
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="pr-14"
        />
        <button
          type="button"
          className="mk-button mk-button--text mk-button--icon absolute top-1/2 right-2 -translate-y-1/2"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => setVisible((v) => !v)}
        >
          <Icon name={visible ? 'visibility_off' : 'visibility'} />
        </button>
      </div>
    </div>
  );
}
