import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { FadeContent, LoadingButton, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/fade-content';
import '@yewdiel21/motion-kit/css/components/loading-button';
import { AuthError, login, refreshSession } from '@/shared/auth/session';
import { useAuth } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';
import { ThemeToggle } from '@/shared/ui/ThemeToggle';

type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// Solo en desarrollo: cuentas sintéticas sembradas por el backend (Identity:DemoPassword).
const DEMO_ACCOUNTS = import.meta.env.DEV
  ? ['admin@violetcode.demo', 'coordinacion@violetcode.demo', 'psicologia@violetcode.demo']
  : [];

export default function LoginPage() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);

  // Si ya hay una sesión válida (cookie), no pedir credenciales de nuevo.
  useEffect(() => {
    if (status === 'checking') void refreshSession();
  }, [status]);

  if (status === 'authenticated' && state !== 'success') return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    if (state === 'loading') return;
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
    <div className="grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      {/* Panel de marca */}
      <aside className="relative hidden overflow-hidden bg-primary-container p-12 text-on-primary-container lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary text-xl font-semibold text-on-primary">V</span>
          <span className="text-lg font-semibold">Violet Code</span>
        </div>
        <FadeContent as="div" stagger={90} className="max-w-md">
          <h1 data-mk-fade-item className="text-4xl leading-tight font-semibold tracking-tight">
            Cada solicitud, atendida y acompañada.
          </h1>
          <p data-mk-fade-item className="mt-4 text-lg opacity-80">
            Plataforma de atención, seguimiento y analítica para la Secretaría de las Mujeres de Ahome.
          </p>
        </FadeContent>
        <p className="text-sm opacity-70">2do Hackathon FIM-UAS 2026 · Entorno de demostración con datos sintéticos</p>
        <div aria-hidden className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-primary opacity-20 blur-3xl" />
      </aside>

      {/* Formulario */}
      <main className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>

        <FadeContent as="section" stagger={60} className="m-auto w-full max-w-sm py-10">
          <h2 data-mk-fade-item className="text-3xl font-semibold tracking-tight text-on-surface">Iniciar sesión</h2>
          <p data-mk-fade-item className="mt-2 text-on-surface-variant">Acceso exclusivo para el personal de SEMUJERES.</p>

          <form data-mk-fade-item onSubmit={onSubmit} className="mt-8 grid gap-4" noValidate>
            <label className="mk-field">
              <span className="mk-field__label">Correo institucional</span>
              <input
                type="email"
                name="email"
                autoComplete="username"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </label>

            <label className="mk-field">
              <span className="mk-field__label">Contraseña</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'login-error' : undefined}
                  className="pr-12"
                />
                <button
                  type="button"
                  className="mk-button mk-button--icon mk-button--text absolute top-1/2 right-1 -translate-y-1/2"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <Icon name={showPassword ? 'visibility_off' : 'visibility'} />
                </button>
              </div>
            </label>

            <p id="login-error" role="alert" className="min-h-5 text-sm text-error">
              {error}
            </p>

            <LoadingButton
              type="submit"
              state={state}
              className="mk-button mk-button--primary mk-button--lg w-full"
              labels={{ loading: 'Verificando…', success: 'Bienvenida', error: 'Intenta de nuevo' }}
              compact={false}
              resetAfter={1800}
              onStateChange={(s) => s === 'idle' && setState('idle')}
              disabled={!email || !password}
            >
              Entrar
            </LoadingButton>
          </form>

          {DEMO_ACCOUNTS.length > 0 && (
            <div data-mk-fade-item className="mt-8 rounded-3xl bg-surface-container p-4 text-sm text-on-surface-variant">
              <p className="font-medium text-on-surface">Cuentas de demostración</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <li key={account}>
                    <button type="button" className="mk-chip" onClick={() => setEmail(account)}>
                      {account.split('@')[0]}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-2">Contraseña: la de <code>Identity:DemoPassword</code> en appsettings.Development.json</p>
            </div>
          )}
        </FadeContent>
      </main>
    </div>
  );
}
