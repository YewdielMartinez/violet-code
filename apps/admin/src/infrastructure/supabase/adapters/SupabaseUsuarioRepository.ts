import { createIsolatedAuthClient, supabase } from '../client';
import type { StaffRole } from '@/domain/models/Auth';
import {
  rolRequiereArea,
  tipoCuentaDeRol,
  type UsuarioCreateInput,
  type UsuarioCuenta,
  type UsuarioUpdateInput,
} from '@/domain/models/Usuario';
import { UsuarioError, type UsuarioRepository } from '@/domain/ports/UsuarioRepository';

type EmpleadoRol = Exclude<StaffRole, 'umeca'>;

const EMPLEADO_SELECT = 'id, nombre, rol, area_id, activo, creado_en, actualizado_en, cat_area(nombre)';
const EXTERNO_SELECT = 'id, nombre, dependencia, activo, creado_en, actualizado_en';

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

interface EmpleadoRow {
  id: string;
  nombre: string;
  rol: EmpleadoRol;
  area_id: number | null;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
  cat_area: { nombre: string } | { nombre: string }[] | null;
}

interface ExternoRow {
  id: string;
  nombre: string;
  dependencia: string;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
}

export function mapEmpleadoRow(row: EmpleadoRow): UsuarioCuenta {
  return {
    id: row.id,
    tipo: 'empleado',
    nombre: row.nombre,
    rol: row.rol,
    areaId: row.area_id,
    areaNombre: unwrapOne(row.cat_area)?.nombre ?? null,
    activo: row.activo,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
  };
}

export function mapExternoRow(row: ExternoRow): UsuarioCuenta {
  return {
    id: row.id,
    tipo: 'externo',
    nombre: row.nombre,
    rol: 'umeca',
    areaId: null,
    areaNombre: row.dependencia === 'umeca' ? 'UMECA' : row.dependencia,
    activo: row.activo,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
  };
}

function toUsuarioError(error: { code?: string; message?: string } | null, fallback: string): UsuarioError {
  const code = error?.code;
  if (code === '42501' || code === 'PGRST301') {
    return new UsuarioError('permiso', 'No tienes permiso para gestionar cuentas.');
  }
  return new UsuarioError('desconocido', error?.message?.trim() || fallback);
}

/** `cat_area.id` del rol (la clave del área es la misma que la del rol). `null` si el rol no lleva área. */
async function resolveAreaId(rol: StaffRole): Promise<number | null> {
  if (!rolRequiereArea(rol)) return null;
  const { data, error } = await supabase.from('cat_area').select('id').eq('clave', rol).maybeSingle();
  if (error) throw toUsuarioError(error, 'No se pudo consultar el área del rol.');
  if (!data) throw new UsuarioError('desconocido', 'No existe el área correspondiente al rol seleccionado.');
  return data.id;
}

async function assertPuedeGestionarCuentas(): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const actorId = sessionData.session?.user.id;
  if (!actorId) throw new UsuarioError('permiso', 'Tu sesión expiró. Vuelve a iniciar sesión.');

  const { data: permitido, error } = await supabase.rpc('tiene_permiso', { p_permiso: 'cuentas.gestionar' });
  if (error) throw toUsuarioError(error, 'No se pudo validar tu permiso para gestionar cuentas.');
  if (!permitido) throw new UsuarioError('permiso', 'No tienes permiso para gestionar cuentas.');
  return actorId;
}

function mapSignUpError(raw: string, status?: number): UsuarioError {
  const lower = raw.toLowerCase();
  if (lower.includes('already registered') || lower.includes('already been registered') || lower.includes('exists')) {
    return new UsuarioError('correo_duplicado', 'Ya existe una cuenta con ese correo electrónico.');
  }
  if (status === 429 || lower.includes('rate limit') || lower.includes('too many')) {
    return new UsuarioError('auth', 'Demasiados intentos de alta. Espera un minuto e inténtalo de nuevo.');
  }
  if (lower.includes('password')) {
    return new UsuarioError('auth', 'La contraseña temporal no cumple la política de seguridad de Supabase.');
  }
  if (lower.includes('signups not allowed') || lower.includes('signup is disabled')) {
    return new UsuarioError('auth', 'El alta de cuentas está deshabilitada en Supabase Auth.');
  }
  return new UsuarioError('auth', raw || 'No se pudo crear la cuenta de acceso.');
}

/** Crea la credencial en Supabase Auth sin tocar la sesión actual y devuelve el `id` de `auth.users`. */
async function crearCredencial(correo: string, contrasena: string, nombre: string): Promise<string> {
  const authClient = createIsolatedAuthClient();
  const { data, error } = await authClient.auth.signUp({
    email: correo.trim().toLowerCase(),
    password: contrasena,
    options: { data: { nombre } },
  });
  if (error) throw mapSignUpError(error.message, error.status);
  const user = data.user;
  // Con protección contra enumeración, Supabase responde un usuario "falso" sin identidades si el correo ya existe.
  if (!user || (Array.isArray(user.identities) && user.identities.length === 0)) {
    throw new UsuarioError('correo_duplicado', 'Ya existe una cuenta con ese correo electrónico.');
  }
  if (data.session) {
    // La sesión de la cuenta nueva no se usa: se cierra para no dejar tokens vivos en memoria.
    await authClient.auth.signOut({ scope: 'local' }).catch(() => undefined);
  }
  return user.id;
}

export const supabaseUsuarioRepository: UsuarioRepository = {
  async listar() {
    const [empleados, externos] = await Promise.all([
      supabase.from('empleado').select(EMPLEADO_SELECT).order('nombre', { ascending: true }),
      supabase.from('usuario_externo').select(EXTERNO_SELECT).order('nombre', { ascending: true }),
    ]);
    if (empleados.error) throw toUsuarioError(empleados.error, 'No se pudo cargar el personal.');
    if (externos.error) throw toUsuarioError(externos.error, 'No se pudieron cargar las cuentas externas.');

    const cuentas = [
      ...((empleados.data ?? []) as EmpleadoRow[]).map(mapEmpleadoRow),
      ...((externos.data ?? []) as ExternoRow[]).map(mapExternoRow),
    ];
    return cuentas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-MX'));
  },

  async crear(input: UsuarioCreateInput) {
    const actorId = await assertPuedeGestionarCuentas();
    const nombre = input.nombre.trim();
    const areaId = await resolveAreaId(input.rol);
    const userId = await crearCredencial(input.correo, input.contrasena, nombre);

    const perfilError = (raw: { code?: string; message?: string } | null) =>
      new UsuarioError(
        'perfil',
        `Se creó el acceso de ${input.correo.trim()}, pero no se pudo registrar su perfil` +
          (raw?.message ? ` (${raw.message})` : '') +
          '. Pide a Soporte que lo complete desde Supabase.',
      );

    if (tipoCuentaDeRol(input.rol) === 'externo') {
      const { data, error } = await supabase
        .from('usuario_externo')
        .insert({ id: userId, nombre, dependencia: 'umeca', creado_por: actorId })
        .select(EXTERNO_SELECT)
        .single();
      if (error || !data) throw perfilError(error);
      return mapExternoRow(data as ExternoRow);
    }

    const { data, error } = await supabase
      .from('empleado')
      .insert({ id: userId, nombre, rol: input.rol as EmpleadoRol, area_id: areaId, creado_por: actorId })
      .select(EMPLEADO_SELECT)
      .single();
    if (error || !data) throw perfilError(error);
    return mapEmpleadoRow(data as EmpleadoRow);
  },

  async actualizar(cuenta, input: UsuarioUpdateInput) {
    const nombre = input.nombre.trim();
    if (tipoCuentaDeRol(input.rol) !== cuenta.tipo) {
      throw new UsuarioError('desconocido', 'No se puede cambiar una cuenta entre personal interno y externo.');
    }

    if (cuenta.tipo === 'externo') {
      const { data, error } = await supabase
        .from('usuario_externo')
        .update({ nombre, activo: input.activo })
        .eq('id', cuenta.id)
        .select(EXTERNO_SELECT)
        .single();
      if (error || !data) throw toUsuarioError(error, 'No se pudo actualizar la cuenta.');
      return mapExternoRow(data as ExternoRow);
    }

    const areaId = await resolveAreaId(input.rol);
    const { data, error } = await supabase
      .from('empleado')
      .update({ nombre, rol: input.rol as EmpleadoRol, area_id: areaId, activo: input.activo })
      .eq('id', cuenta.id)
      .select(EMPLEADO_SELECT)
      .single();
    if (error || !data) throw toUsuarioError(error, 'No se pudo actualizar la cuenta.');
    return mapEmpleadoRow(data as EmpleadoRow);
  },

  async cambiarActivo(cuenta, activo) {
    const fallback = 'No se pudo cambiar el estado de la cuenta.';
    if (cuenta.tipo === 'externo') {
      const { data, error } = await supabase
        .from('usuario_externo')
        .update({ activo })
        .eq('id', cuenta.id)
        .select(EXTERNO_SELECT)
        .single();
      if (error || !data) throw toUsuarioError(error, fallback);
      return mapExternoRow(data as ExternoRow);
    }
    const { data, error } = await supabase
      .from('empleado')
      .update({ activo })
      .eq('id', cuenta.id)
      .select(EMPLEADO_SELECT)
      .single();
    if (error || !data) throw toUsuarioError(error, fallback);
    return mapEmpleadoRow(data as EmpleadoRow);
  },
};
