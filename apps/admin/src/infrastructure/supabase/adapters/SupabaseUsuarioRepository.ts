import { supabase } from '../client';
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

/** Traduce los errores del RPC `crear_cuenta_acceso` (SQLSTATE + mensaje en español) a `UsuarioError`. */
export function mapCrearCuentaError(error: { code?: string; message?: string } | null): UsuarioError {
  const code = error?.code;
  const message = error?.message?.trim() ?? '';
  if (code === '42501' || code === 'PGRST301') {
    return new UsuarioError('permiso', 'No tienes permiso para gestionar cuentas.');
  }
  if (code === '23505') {
    return new UsuarioError('correo_duplicado', 'Ya existe una cuenta con ese correo electrónico.');
  }
  if (code === '23514' && message) {
    return new UsuarioError('auth', message);
  }
  return new UsuarioError('auth', message || 'No se pudo crear la cuenta de acceso.');
}

interface CrearCuentaRpcClient {
  rpc: (
    fn: 'crear_cuenta_acceso',
    args: { p_correo: string; p_contrasena: string; p_nombre: string; p_rol: string },
  ) => PromiseLike<{ data: string | null; error: { code?: string; message?: string } | null }>;
}

/**
 * Crea la credencial (ya confirmada) y el perfil en una sola transacción con el RPC `crear_cuenta_acceso`.
 * Se evita `auth.signUp()`: con `enable_confirmations` dejaba la cuenta "sin confirmar" y no podía iniciar sesión.
 * TODO: quitar el cast cuando se regeneren los tipos (`database.types.ts`) tras la migración 68.
 */
async function crearCuentaAcceso(input: UsuarioCreateInput, nombre: string): Promise<string> {
  const { data, error } = await (supabase as unknown as CrearCuentaRpcClient).rpc('crear_cuenta_acceso', {
    p_correo: input.correo.trim().toLowerCase(),
    p_contrasena: input.contrasena,
    p_nombre: nombre,
    p_rol: input.rol,
  });
  if (error || !data) throw mapCrearCuentaError(error);
  return data;
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
    await assertPuedeGestionarCuentas();
    const nombre = input.nombre.trim();
    const userId = await crearCuentaAcceso(input, nombre);

    const perfilError = (raw: { code?: string; message?: string } | null) =>
      new UsuarioError(
        'perfil',
        `Se creó el acceso de ${input.correo.trim()}, pero no se pudo cargar su perfil` +
          (raw?.message ? ` (${raw.message})` : '') +
          '. Actualiza la lista de cuentas.',
      );

    if (tipoCuentaDeRol(input.rol) === 'externo') {
      const { data, error } = await supabase.from('usuario_externo').select(EXTERNO_SELECT).eq('id', userId).single();
      if (error || !data) throw perfilError(error);
      return mapExternoRow(data as ExternoRow);
    }

    const { data, error } = await supabase.from('empleado').select(EMPLEADO_SELECT).eq('id', userId).single();
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
