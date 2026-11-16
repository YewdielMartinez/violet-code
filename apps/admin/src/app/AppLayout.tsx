import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BranchNav } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/branch-nav';
import { NAVIGATION } from './navigation';

// Estáticos: se calculan una vez, no en cada render (evita que BranchNav reciba props nuevas).
const NAV_ITEMS = NAVIGATION.map((section) => ({
  label: section.label,
  children: section.items.map((item) => ({ label: item.label, value: item.path })),
}));
const ALL_SECTIONS_OPEN = NAVIGATION.map((_, i) => i);

export function AppLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-full">
      <aside className="hidden w-72 shrink-0 flex-col gap-6 border-r border-outline-variant bg-surface-container-low px-5 py-6 md:flex">
        <div className="flex items-center gap-3 px-2">
          <span aria-hidden className="grid size-9 place-items-center rounded-2xl bg-primary font-semibold text-on-primary">
            V
          </span>
          <div className="leading-tight">
            <p className="font-semibold text-on-surface">Violet Code</p>
            <p className="text-xs text-on-surface-variant">Administración</p>
          </div>
        </div>

        <BranchNav
          label="Navegación principal"
          items={NAV_ITEMS}
          defaultOpen={ALL_SECTIONS_OPEN}
          defaultActive={pathname}
          onSelect={(path) => navigate(path)}
        />

        <p className="mt-auto rounded-2xl bg-tertiary-container px-3 py-2 text-xs text-on-tertiary-container">
          Entorno de demostración · solo datos sintéticos
        </p>
      </aside>

      <main className="min-w-0 flex-1 px-6 py-8 md:px-10">
        <Outlet />
      </main>
    </div>
  );
}
