import { useState, type ReactNode } from 'react';
import { ChatBackground, Dialog } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import '@yewdiel21/motion-kit/css/components/chat-background';
import { ROLE_LABELS, useAuth } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';

type Tab = 'account' | 'security';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'account', label: 'Cuenta', icon: 'account_circle' },
  { id: 'security', label: 'Seguridad', icon: 'shield_lock' },
];

/** Tarjeta de sección, con aire (como el resto de paneles de motion-kit). */
function Card({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-outline-variant bg-surface-container-low p-7">
      <Icon name={icon} className="text-on-surface-variant" />
      <h3 className="mt-4 text-xl font-medium text-on-surface">{title}</h3>
      <div className="mt-1.5 text-on-surface-variant">{children}</div>
    </section>
  );
}

function AccountPanel() {
  const { user } = useAuth();
  if (!user) return null;
  const area = user.areaNombre ?? 'Todas las áreas';

  return (
    <div className="grid gap-4">
      {/* Fondo vivo de motion-kit (ChatBackground): dos manchas del tema que orbitan lentamente. */}
      <section className="relative isolate flex min-h-80 flex-col justify-end overflow-hidden rounded-[2rem] bg-surface-container-low p-8">
        <ChatBackground energy={0.2} className="-z-10" />
        <p className="text-sm text-on-surface-variant">Correo</p>
        <p className="truncate text-xl text-on-surface" title={user.email}>
          {user.email}
        </p>
        <p className="mt-5 text-sm text-on-surface-variant">Nombre</p>
        <p className="truncate text-4xl font-medium tracking-tight text-on-surface uppercase md:text-5xl" title={user.displayName}>
          {user.displayName}
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card icon="badge" title={ROLE_LABELS[user.role]}>
          Rol en el sistema. Define qué módulos y expedientes puedes ver.
        </Card>
        <Card icon="groups" title={area}>
          Área de atención a la que perteneces.
        </Card>
      </div>
    </div>
  );
}

function SecurityPanel() {
  return (
    <div className="grid gap-4">
      <Card icon="verified_user" title="Sesión protegida">
        Tu sesión usa Supabase Auth con renovación automática y cierre tras 30 minutos de inactividad en equipos compartidos.
      </Card>
      <Card icon="policy" title="Actividad auditada">
        Cada acceso y cada consulta de expedientes queda registrada en la bitácora de auditoría.
      </Card>
      <Card icon="lock_reset" title="Contraseña">
        Para cambiarla o restablecerla, contacta a la administración del sistema.
      </Card>
    </div>
  );
}

/** Configuración de la cuenta: sub-navegación lateral (Cuenta, Seguridad) y panel de detalle. */
export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [tab, setTab] = useState<Tab>('account');

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="xl">
        <Dialog.Header>
          <Dialog.Title>Configuración</Dialog.Title>
          <Dialog.Close label="Cerrar" />
        </Dialog.Header>

        <Dialog.Body>
          <div className="grid gap-6 md:grid-cols-[13rem_1fr]">
            <nav aria-label="Secciones de configuración" className="flex gap-2 md:flex-col">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-current={tab === t.id ? 'page' : undefined}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-3 rounded-full px-4 py-3 text-left transition-colors ${
                    tab === t.id
                      ? 'bg-surface-container-high font-medium text-on-surface'
                      : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <Icon name={t.icon} filled={tab === t.id} />
                  {t.label}
                </button>
              ))}
            </nav>

            {tab === 'account' ? <AccountPanel /> : <SecurityPanel />}
          </div>
        </Dialog.Body>
      </Dialog.Content>
    </Dialog.Root>
  );
}
