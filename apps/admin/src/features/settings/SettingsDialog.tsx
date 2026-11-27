import { useState, type ReactNode } from 'react';
import { Dialog } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import { PerfilCuentaSection } from '@/features/perfil/PerfilCuentaSection';
import { DeferredDialogContent } from '@/shared/ui/DeferredDialogContent';
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
        Puedes cambiarla en la sección Cuenta; para restablecerla si la olvidaste, contacta a la administración del sistema.
      </Card>
    </div>
  );
}

/** Marcador liviano mientras el diálogo se anima: sin componentes del kit ni efectos (ver `DeferredDialogContent`). */
function PanelFallback() {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando configuración" className="grid gap-4">
      {[7, 6, 6, 6].map((height, index) => (
        <div key={index} style={{ height: `${height}rem` }} className="rounded-3xl bg-surface-container-low" />
      ))}
    </div>
  );
}

/**
 * Configuración de la cuenta: sub-navegación lateral (Cuenta, Seguridad) y panel de detalle.
 * «Cuenta» concentra el perfil de quien inició sesión (datos de contacto, contraseña, permisos, cerrar sesión).
 * El panel (y la carga de `get_mi_perfil`) espera a que termine el morph de apertura del diálogo.
 */
export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [tab, setTab] = useState<Tab>('account');
  // Verdadero desde que se abre hasta que termina de cerrarse (el contenido sigue montado durante la animación de salida).
  const [active, setActive] = useState(false);
  if (open && !active) setActive(true);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} onAfterClose={() => setActive(false)}>
      <Dialog.Content size="xl" className="vc-perf-dialog">
        <Dialog.Header>
          <Dialog.Title>Configuración</Dialog.Title>
          <Dialog.Close label="Cerrar" />
        </Dialog.Header>

        <Dialog.Body>
          <div className="grid gap-6 md:grid-cols-[13rem_minmax(0,1fr)]">
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

            <div className="min-w-0">
              <DeferredDialogContent active={active} fallback={<PanelFallback />}>
                {tab === 'account' ? <PerfilCuentaSection enabled={open} /> : <SecurityPanel />}
              </DeferredDialogContent>
            </div>
          </div>
        </Dialog.Body>
      </Dialog.Content>
    </Dialog.Root>
  );
}
