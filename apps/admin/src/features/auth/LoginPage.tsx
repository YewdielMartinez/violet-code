import { useEffect, useId, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Dialog, LoadingButton, PillButton, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import '@yewdiel21/motion-kit/css/components/loading-button';
import '@yewdiel21/motion-kit/css/components/pill-button';
import { AuthError, login, refreshSession } from '@/shared/auth/session';
import { useAuth } from '@/shared/auth/useAuth';
import { PasswordField } from './PasswordField';
import { LoginHero } from './LoginHero';
import { PrivacyNoticeDialog } from './PrivacyNoticeDialog';

type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// Solo en desarrollo: cuentas sintéticas sembradas por el backend (Identity:DemoPassword).
const DEMO_ACCOUNTS = import.meta.env.DEV
  ? ['admin@violetcode.demo', 'coordinacion@violetcode.demo', 'psicologia@violetcode.demo']
  : [];

function LoginForm({ formId }: { formId: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const errorId = useId();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (state === 'loading') return;
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    setError(null);
    setState('loading');
    try {
      await login(email, password);
      setState('success');
      // Deja ver el check de éxito del botón antes de entrar.
      setTimeout(() => navigate(from, { replace: true }), 600);
    } catch (err) {
      const message = err instanceof AuthError ? err.message : 'No se pudo conectar con el servidor.';
      setState('error');
      setError(message);
      setPassword('');
      toast(message, { tone: 'error', origin: submitter });
    }
  }

  return (
    <>
      <Dialog.Body>
        <form id={formId} onSubmit={onSubmit} className="grid gap-4" noValidate>
          <label className="mk-field">
            <span className="mk-field__label">Correo institucional</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              inputMode="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
          </label>

          <PasswordField
            value={password}
            onChange={setPassword}
            invalid={Boolean(error)}
            describedBy={error ? errorId : undefined}
          />

          <p id={errorId} role="alert" className="min-h-5 text-sm text-error">
            {error}
          </p>

          {DEMO_ACCOUNTS.length > 0 && (
            <div className="rounded-2xl bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
              <p className="font-medium text-on-surface">Cuentas de demostración</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <button key={account} type="button" className="mk-chip" onClick={() => setEmail(account)}>
                    {account.split('@')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </Dialog.Body>

      <Dialog.Footer>
        <div className="grid w-full gap-3">
          <LoadingButton
            type="submit"
            form={formId}
            state={state}
            className="mk-button mk-button--primary mk-button--lg w-full"
            labels={{ loading: 'Verificando…', success: 'Acceso concedido', error: 'Intenta de nuevo' }}
            compact={false}
            resetAfter={1800}
            onStateChange={(s) => s === 'idle' && setState('idle')}
            disabled={!email || !password}
          >
            Entrar
          </LoadingButton>
          <p className="text-center text-xs text-on-surface-variant">
            ¿Olvidaste tu contraseña? Solicita el restablecimiento a la administración del sistema.
          </p>
        </div>
      </Dialog.Footer>
    </>
  );
}

export default function LoginPage() {
  const { status } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const formId = useId();
  const [open, setOpen] = useState(false);

  // Si ya hay una sesión válida (cookie), no pedir credenciales de nuevo.
  useEffect(() => {
    if (status === 'checking') void refreshSession();
  }, [status]);

  if (status === 'authenticated' && !open) return <Navigate to={from} replace />;

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-background">

      <header className="relative flex items-center justify-between gap-4 px-6 py-6 sm:px-10">
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid size-9 place-items-center rounded-xl bg-primary font-semibold text-on-primary">
            V
          </span>
          <span className="font-semibold text-on-surface">Violet Code</span>
        </div>
        <PrivacyNoticeDialog />
      </header>

      <main className="relative mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-10 sm:px-10">
        <LoginHero
          cta={
            <>
              {/* motion-kit PillButton: el relleno se recoge en el círculo de la flecha al pasar el cursor. */}
              <PillButton
                onClick={() => setOpen(true)}
                style={{ '--mk-pill-ink': 'var(--md-sys-color-primary)', '--mk-pill-on-ink': 'var(--md-sys-color-on-primary)' } as React.CSSProperties}
              >
                Iniciar sesión
              </PillButton>
              {/* El Dialog crece desde el botón que tenía el foco (motion-kit). */}
              <Dialog.Root open={open} onOpenChange={setOpen}>
                <Dialog.Content size="sm">
                  <Dialog.Header>
                    <Dialog.Title>Iniciar sesión</Dialog.Title>
                    <Dialog.Close label="Cerrar" />
                  </Dialog.Header>
                  <Dialog.Description>Usa tu correo institucional y tu contraseña personal.</Dialog.Description>
                  <LoginForm formId={formId} />
                </Dialog.Content>
              </Dialog.Root>
            </>
          }
        />
      </main>

      <footer className="relative px-6 py-6 text-xs text-on-surface-variant sm:px-10">
        Prototipo académico · 2do Hackathon FIM-UAS 2026 · Datos sintéticos
      </footer>
    </div>
  );
}
