import { queryClient } from '@/app/queryClient';
import { supabaseAuthRepository } from '@/infrastructure/supabase/adapters/SupabaseAuthRepository';
import type { AuthSession, StaffRole, StaffUser, UmecaCita } from '@/domain/models/Auth';
import { AuthError } from '@/domain/ports/AuthRepository';

export type { AuthSession, StaffRole, StaffUser, UmecaCita };
export { AuthError };

export type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

interface State {
  status: AuthStatus;
  session: AuthSession | null;
}

const IDLE_TIMEOUT_MS = 30 * 60_000;

let state: State = { status: 'checking', session: null };
const listeners = new Set<() => void>();
let initialized = false;
let sessionPromise: Promise<AuthSession | null> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | undefined;

let cachedUserId: string | null = null;

function setState(next: State) {
  const nextUserId = next.session?.user.id ?? null;
  // Al cerrar sesión o cambiar de usuario se vacía la caché de TanStack Query para que
  // el siguiente usuario no vea datos cargados con los permisos del anterior.
  if (nextUserId !== cachedUserId) {
    if (cachedUserId !== null) queryClient.clear();
    cachedUserId = nextUserId;
  }
  state = next;
  listeners.forEach((l) => l());
}

function clearIdleTimer() {
  if (idleTimer !== undefined) {
    clearTimeout(idleTimer);
    idleTimer = undefined;
  }
}

function resetIdleTimer() {
  clearIdleTimer();
  if (state.status !== 'authenticated') return;
  idleTimer = setTimeout(() => {
    void logout();
  }, IDLE_TIMEOUT_MS);
}

let activityBound = false;
function bindActivityListeners() {
  if (activityBound || typeof window === 'undefined') return;
  activityBound = true;
  const bump = () => resetIdleTimer();
  for (const evt of ['pointerdown', 'keydown', 'touchstart'] as const) {
    window.addEventListener(evt, bump, { passive: true });
  }
}

function ensureAuthSubscription() {
  if (initialized) return;
  initialized = true;
  bindActivityListeners();
  supabaseAuthRepository.onAuthStateChange((session) => {
    if (session) {
      setState({ status: 'authenticated', session });
      resetIdleTimer();
    } else {
      clearIdleTimer();
      setState({ status: 'anonymous', session: null });
    }
  });
}

export async function login(email: string, password: string): Promise<AuthSession> {
  ensureAuthSubscription();
  const session = await supabaseAuthRepository.login(email, password);
  setState({ status: 'authenticated', session });
  resetIdleTimer();
  return session;
}

/** Recupera la sesión activa desde Supabase Auth y valida que el perfil siga activo. */
export function refreshSession(): Promise<AuthSession | null> {
  ensureAuthSubscription();
  sessionPromise ??= supabaseAuthRepository
    .getSession()
    .then((session) => {
      if (session) {
        setState({ status: 'authenticated', session });
        resetIdleTimer();
      } else {
        clearIdleTimer();
        setState({ status: 'anonymous', session: null });
      }
      return session;
    })
    .catch(() => {
      clearIdleTimer();
      setState({ status: 'anonymous', session: null });
      return null;
    })
    .finally(() => {
      sessionPromise = null;
    });
  return sessionPromise;
}

/** Actualiza en memoria datos del usuario de la sesión (p. ej. el nombre tras editar «Cuenta» de Configuración). */
export function updateSessionUser(patch: Partial<Pick<StaffUser, 'displayName'>>): void {
  if (!state.session) return;
  setState({ status: state.status, session: { ...state.session, user: { ...state.session.user, ...patch } } });
}

export async function logout(): Promise<void> {
  clearIdleTimer();
  try {
    await supabaseAuthRepository.logout();
  } finally {
    setState({ status: 'anonymous', session: null });
    queryClient.clear();
  }
}

export async function fetchUmecaCitas(): Promise<UmecaCita[]> {
  return supabaseAuthRepository.getUmecaCitas();
}

export const sessionStore = {
  subscribe(listener: () => void) {
    ensureAuthSubscription();
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => state,
  accessToken: () => state.session?.accessToken ?? null,
};
