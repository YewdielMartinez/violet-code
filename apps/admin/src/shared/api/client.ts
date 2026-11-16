import { refreshSession, sessionStore } from '@/shared/auth/session';

/**
 * Cliente HTTP hacia Violet Code Core.
 * En desarrollo Vite reenvía /api a http://localhost:5080 (ver vite.config.ts).
 * Si el token venció (401), renueva la sesión una vez y reintenta.
 */
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = sessionStore.accessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${BASE_URL}${path}`, { ...init, headers });
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await send(path, init);

  if (res.status === 401 && sessionStore.accessToken()) {
    const renewed = await refreshSession();
    if (renewed) res = await send(path, init);
  }

  if (!res.ok) {
    const problem = await res.json().catch(() => null);
    throw new ApiError(res.status, problem?.title ?? res.statusText);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
