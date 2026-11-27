import { supabase } from '../client';
import type { Database } from '../database.types';
import type { AuthSession, StaffRole, StaffUser, UmecaCita } from '@/domain/models/Auth';
import { AuthError, type AuthRepository } from '@/domain/ports/AuthRepository';

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function mapAuthErrorMessage(status: number | undefined, raw: string): string {
  const lower = raw.toLowerCase();
  if (status === 429 || lower.includes('rate limit') || lower.includes('too many')) {
    return 'Demasiados intentos. Espera un minuto.';
  }
  if (lower.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Tu cuenta aún no ha sido confirmada.';
  }
  return raw || 'No se pudo iniciar sesión con Supabase.';
}

async function resolveStaffUser(userId: string, email: string): Promise<StaffUser> {
  const { data: empleado, error: empError } = await supabase
    .from('empleado')
    .select('id, nombre, rol, area_id, activo, cat_area(clave, nombre)')
    .eq('id', userId)
    .maybeSingle();

  if (empError) {
    throw new AuthError(500, 'No se pudo consultar el perfil del personal.');
  }

  if (empleado) {
    if (!empleado.activo) {
      await supabase.auth.signOut();
      throw new AuthError(403, 'Tu cuenta está desactivada. Contacta a la administración.');
    }
    const area = unwrapOne(empleado.cat_area);
    return {
      id: empleado.id,
      email,
      displayName: empleado.nombre,
      role: empleado.rol as StaffRole,
      areaId: empleado.area_id,
      areaClave: area?.clave ?? null,
      areaNombre: area?.nombre ?? null,
      activo: empleado.activo,
    };
  }

  const { data: externo, error: extError } = await supabase
    .from('usuario_externo')
    .select('id, nombre, dependencia, activo')
    .eq('id', userId)
    .maybeSingle();

  if (extError) {
    throw new AuthError(500, 'No se pudo consultar el perfil externo.');
  }

  if (externo && externo.dependencia === 'umeca') {
    if (!externo.activo) {
      await supabase.auth.signOut();
      throw new AuthError(403, 'Tu cuenta externa está desactivada. Contacta a SEMUJERES.');
    }
    return {
      id: externo.id,
      email,
      displayName: externo.nombre,
      role: 'umeca',
      areaId: null,
      areaClave: 'umeca',
      areaNombre: 'UMECA',
      activo: externo.activo,
    };
  }

  await supabase.auth.signOut();
  throw new AuthError(403, 'Esta cuenta no tiene acceso al panel administrativo.');
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
