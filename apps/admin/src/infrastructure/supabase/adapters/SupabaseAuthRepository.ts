import { supabase } from '../client';
import type { Database } from '../database.types';
import type { AuthSession, StaffRole, StaffUser, UmecaCita } from '@/domain/models/Auth';
import { AuthError, type AuthRepository } from '@/domain/ports/AuthRepository';

type MiPerfilBaseRow = Database['public']['Functions']['get_mi_perfil']['Returns'][number];

type MiPerfilRow = Omit<
  MiPerfilBaseRow,
  'area_id' | 'area_clave' | 'area_nombre' | 'dependencia' | 'permisos'
> & {
  area_id: number | null;
  area_clave: string | null;
  area_nombre: string | null;
  dependencia: string | null;
  permisos: string[] | null;
};

export function mapMiPerfilToStaffUser(row: MiPerfilRow, fallbackEmail: string): StaffUser {
  return {
    id: row.id,
    email: row.email || fallbackEmail,
    displayName: row.nombre,
    role: row.rol as StaffRole,
    areaId: row.area_id ?? null,
    areaClave: row.area_clave ?? null,
    areaNombre: row.area_nombre ?? null,
    dependencia: row.dependencia ?? null,
    activo: row.activo,
    permisos: row.permisos ?? [],
  };
}

export function mapAuthErrorMessage(status: number | undefined, raw: string): string {
  const lower = raw.toLowerCase();
  if (status === 429 || lower.includes('rate limit') || lower.includes('too many')) {
    return 'Demasiados intentos. Espera un minuto.';
  }
  if (lower.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Tu correo aún no ha sido confirmado. Pide a la administración de SEMUJERES que active tu cuenta.';
  }
  if (lower.includes('user is banned') || lower.includes('banned')) {
    return 'Tu cuenta está desactivada. Contacta a la administración.';
  }
  return raw || 'No se pudo iniciar sesión con Supabase.';
}

async function resolveStaffUser(_userId: string, email: string): Promise<StaffUser> {
  const { data, error } = await supabase.rpc('get_mi_perfil').maybeSingle();

  if (error) {
    throw new AuthError(500, 'No se pudo consultar el perfil del usuario.');
  }

  if (!data) {
    await supabase.auth.signOut();
    throw new AuthError(403, 'Esta cuenta no tiene acceso al panel administrativo.');
  }

  if (!data.activo) {
    await supabase.auth.signOut();
    throw new AuthError(
      403,
      data.tipo === 'externo'
        ? 'Tu cuenta externa está desactivada. Contacta a SEMUJERES.'
        : 'Tu cuenta está desactivada. Contacta a la administración.',
    );
  }

  return mapMiPerfilToStaffUser(data, email);
}

// Al cargar, getSession() y onAuthStateChange (INITIAL_SESSION / SIGNED_IN) piden el mismo perfil
// casi a la vez: se comparte la consulta en vuelo para no repetir la petición a `empleado`.
const STAFF_DEDUPE_MS = 5_000;
const staffInFlight = new Map<string, Promise<StaffUser>>();

function resolveStaffUserShared(userId: string, email: string): Promise<StaffUser> {
  const cached = staffInFlight.get(userId);
  if (cached) return cached;
  const pending = resolveStaffUser(userId, email);
  staffInFlight.set(userId, pending);
  const release = () => setTimeout(() => staffInFlight.delete(userId), STAFF_DEDUPE_MS);
  pending.then(release, () => staffInFlight.delete(userId));
  return pending;
}

function toAuthSession(accessToken: string, expiresAtSeconds: number | undefined, user: StaffUser): AuthSession {
  const expiresAt = expiresAtSeconds
    ? new Date(expiresAtSeconds * 1000).toISOString()
    : new Date(Date.now() + 3600_000).toISOString();
  return { accessToken, expiresAt, user };
}

type UmecaCitaBaseRow = Database['public']['Functions']['get_umeca_citas']['Returns'][number];

type UmecaCitaRow = Omit<UmecaCitaBaseRow, 'area_clave' | 'area_nombre'> & {
  area_clave?: string | null;
  area_nombre?: string | null;
};

export function mapUmecaCitaRow(row: UmecaCitaRow): UmecaCita {
  return {
    citaId: row.cita_id,
    programadaEn: row.programada_en,
    estado: row.estado,
    nombres: row.nombres,
    apellidoPaterno: row.apellido_paterno,
    apellidoMaterno: row.apellido_materno || null,
    areaClave: row.area_clave || null,
    areaNombre: row.area_nombre?.trim() || null,
  };
}

export const supabaseAuthRepository: AuthRepository = {
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      throw new AuthError(error?.status ?? 401, mapAuthErrorMessage(error?.status, error?.message ?? ''));
    }
    const staffUser = await resolveStaffUserShared(data.user.id, data.user.email ?? email);
    return toAuthSession(data.session.access_token, data.session.expires_at, staffUser);
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new AuthError(error.status ?? 500, error.message);
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) return null;
    try {
      const staffUser = await resolveStaffUserShared(data.session.user.id, data.session.user.email ?? '');
      return toAuthSession(data.session.access_token, data.session.expires_at, staffUser);
    } catch {
      return null;
    }
  },

  onAuthStateChange(listener) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        listener(null);
        return;
      }
      // Evita consultar tablas de forma directa dentro del callback síncrono de GoTrue.
      setTimeout(() => {
        void resolveStaffUserShared(session.user.id, session.user.email ?? '')
          .then((staffUser) => listener(toAuthSession(session.access_token, session.expires_at, staffUser)))
          .catch(() => listener(null));
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  },

  async getUmecaCitas(): Promise<UmecaCita[]> {
    const { data, error } = await supabase.rpc('get_umeca_citas');
    if (error) throw error;
    return ((data ?? []) as UmecaCitaRow[]).map(mapUmecaCitaRow);
  },
};
