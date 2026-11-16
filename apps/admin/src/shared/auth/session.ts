/**
 * Sesión del personal.
 * - El access token (JWT, 15 min) vive SOLO en memoria: no en localStorage (protege ante XSS).
 * - El refresh token viaja en una cookie httpOnly que JavaScript no puede leer.
 * - Al recargar la página, la sesión se recupera con POST /api/identity/refresh.
 */
export type StaffRole = 'admin' | 'coordinacion' | 'profesional' | 'recepcion';

export interface StaffUser {
  id: string;
  email: string;
  displayName: string;
  role: StaffRole;
  area: string | null;
}

export interface Session {
  accessToken: string;
  expiresAt: string;
  user: StaffUser;
}

export type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

interface State {
  status: AuthStatus;
  session: Session | null;
}

const BASE_URL = import.meta.env.VITE_API_URL ?? '';
const REFRESH_MARGIN_MS = 60_000;

let state: State = { status: 'checking', session: null };
const listeners = new Set<() => void>();
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let refreshInFlight: Promise<Session | null> | null = null;

function setState(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

function scheduleRefresh(session: Session) {
  clearTimeout(refreshTimer);
  const ms = new Date(session.expiresAt).getTime() - Date.now() - REFRESH_MARGIN_MS;
  refreshTimer = setTimeout(() => void refreshSession(), Math.max(ms, 5_000));
}

function startSession(session: Session) {
  scheduleRefresh(session);
  setState({ status: 'authenticated', session });
}

function endSession() {
  clearTimeout(refreshTimer);
  setState({ status: 'anonymous', session: null });
}

export class AuthError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}/api/identity${path}`, {
    method: 'POST',
    credentials: 'include', // envía/recibe la cookie de refresh
    headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const problem = await res.json().catch(() => null);
    const message =
      res.status === 429 ? 'Demasiados intentos. Espera un minuto.' : (problem?.title ?? 'No se pudo conectar con el servidor.');
    throw new AuthError(res.status, message);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export async function login(email: string, password: string): Promise<Session> {
  const session = await post<Session>('/login', { email, password });
  startSession(session);
  return session;
}

/** Renueva la sesión. Varias llamadas simultáneas comparten la misma petición. */
export function refreshSession(): Promise<Session | null> {
  refreshInFlight ??= post<Session>('/refresh')
    .then((s) => {
      startSession(s);
      return s;
    })
    .catch(() => {
      endSession();
      return null;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

export async function logout(): Promise<void> {
  try {
    await post('/logout');
  } finally {
    endSession();
  }
}

export const sessionStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => state,
  accessToken: () => state.session?.accessToken ?? null,
};
