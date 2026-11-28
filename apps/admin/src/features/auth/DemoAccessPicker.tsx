import { DEMO_ACCOUNTS, type DemoAccount } from './demoAccounts';

interface DemoAccessPickerProps {
  /** Correo actualmente seleccionado en el formulario (para marcar el chip activo). */
  selectedId?: string;
  onSelect: (account: DemoAccount) => void;
}

/** Acceso rápido de demostración: un chip por rol que rellena correo y contraseña (no envía el formulario). */
export function DemoAccessPicker({ selectedId, onSelect }: DemoAccessPickerProps) {
  return (
    <section className="rounded-2xl bg-surface-container px-4 py-3" aria-labelledby="demo-access-title">
      <h3 id="demo-access-title" className="text-sm font-medium text-on-surface">
        Acceso rápido para la demo
      </h3>
      <p className="mt-0.5 text-xs text-on-surface-variant">
        Elige un rol para rellenar el formulario; después pulsa «Entrar».
      </p>
      <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
        {DEMO_ACCOUNTS.map((account) => {
          const pressed = account.id === selectedId;
          return (
            <button
              key={account.id}
              type="button"
              aria-pressed={pressed}
              aria-label={`Usar cuenta de demostración de ${account.role}`}
              data-demo-chip
              onClick={() => onSelect(account)}
              className={`vc-press vc-demo-chip flex min-w-0 flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left ${
                pressed
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
              }`}
            >
              <span className="text-sm font-medium">{account.role}</span>
              <span className="w-full text-[0.6875rem] leading-tight break-all opacity-70">{account.email}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
