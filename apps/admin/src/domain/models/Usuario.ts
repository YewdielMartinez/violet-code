import { ROLE_LABELS, type StaffRole } from './Auth';

/**
 * Cuentas del panel administradas por Dirección (`cuentas.gestionar`: titular y subdirección).
 * - Personal de SEMUJERES → tabla `empleado` (rol + área).
 * - Consulta externa (hoy solo UMECA) → tabla `usuario_externo`.
 * El `id` de ambas es el mismo de `auth.users`; el correo vive solo en Supabase Auth.
 */
export type TipoCuenta = 'empleado' | 'externo';

export interface UsuarioCuenta {
  id: string;
  tipo: TipoCuenta;
  nombre: string;
  rol: StaffRole;
  areaId: number | null;
  areaNombre: string | null;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

/** Captura del formulario de alta/edición de cuenta. */
export interface UsuarioFormInput {
  nombre: string;
  /** Solo se captura en el alta (no se puede leer ni cambiar desde el panel). */
  correo: string;
  contrasena: string;
  confirmarContrasena: string;
  rol: StaffRole | '';
  activo: boolean;
}

export interface UsuarioCreateInput {
  nombre: string;
  correo: string;
  contrasena: string;
  rol: StaffRole;
}

export interface UsuarioUpdateInput {
  nombre: string;
  rol: StaffRole;
  activo: boolean;
}

export const INITIAL_USUARIO_FORM: UsuarioFormInput = {
  nombre: '',
  correo: '',
  contrasena: '',
  confirmarContrasena: '',
  rol: '',
  activo: true,
};

/** Roles con área obligatoria: `empleado.area_id` debe apuntar a `cat_area` con la misma clave. */
export const ROLES_CON_AREA: readonly StaffRole[] = ['trabajo_social', 'psicologia', 'juridico'];

export const ROLES_ASIGNABLES: readonly StaffRole[] = [
  'titular',
  'subdireccion',
  'trabajo_social',
  'psicologia',
  'juridico',
  'recepcion',
  'umeca',
];

export const ROL_DESCRIPCIONES: Record<StaffRole, string> = {
  titular: 'Supervisión global, cuentas, catálogos, directorio, bitácora e informes.',
  subdireccion: 'Mismos permisos que Dirección: supervisión, cuentas y catálogos.',
  trabajo_social: 'Registra expedientes, canalizaciones, seguimientos y órdenes de protección.',
  psicologia: 'Atiende y da seguimiento en su área; accede al historial clínico.',
  juridico: 'Atiende en su área, órdenes de protección y línea 24/7 de alertas.',
  recepcion: 'Gestiona la agenda y verifica CURP; no ve expedientes.',
  umeca: 'Cuenta externa de solo lectura: citas canalizadas por UMECA.',
};

export { ROLE_LABELS };

export const ESTADO_CUENTA_LABELS = {
  activo: 'Activa',
  inactivo: 'Inactiva',
} as const;

export function tipoCuentaDeRol(rol: StaffRole): TipoCuenta {
  return rol === 'umeca' ? 'externo' : 'empleado';
}

export function rolRequiereArea(rol: StaffRole | ''): boolean {
  return rol !== '' && ROLES_CON_AREA.includes(rol);
}

export const MIN_CONTRASENA = 8;
const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type UsuarioField = 'nombre' | 'correo' | 'contrasena' | 'confirmarContrasena' | 'rol';

export interface UsuarioValidationFailure {
  field: UsuarioField;
  error: string;
}

export function isValidCorreo(correo: string): boolean {
  return CORREO_REGEX.test(correo.trim());
}

/** Paso 1: datos de la cuenta. En edición solo se valida el nombre (correo y contraseña no se tocan). */
export function validateUsuarioCuenta(
  input: UsuarioFormInput,
  mode: 'create' | 'edit',
): UsuarioValidationFailure | null {
  const nombre = input.nombre.trim();
  if (!nombre) return { field: 'nombre', error: 'Escribe el nombre completo de la persona.' };
  if (nombre.length > 120) return { field: 'nombre', error: 'El nombre no puede pasar de 120 caracteres.' };
  if (mode === 'edit') return null;

  if (!isValidCorreo(input.correo)) {
    return { field: 'correo', error: 'Escribe un correo electrónico válido.' };
  }
  if (input.contrasena.length < MIN_CONTRASENA) {
    return {
      field: 'contrasena',
      error: `La contraseña temporal debe tener al menos ${MIN_CONTRASENA} caracteres.`,
    };
  }
  if (!/[A-Za-z]/.test(input.contrasena) || !/[0-9]/.test(input.contrasena)) {
    return { field: 'contrasena', error: 'La contraseña temporal debe combinar letras y números.' };
  }
  if (input.contrasena !== input.confirmarContrasena) {
    return { field: 'confirmarContrasena', error: 'Las contraseñas no coinciden.' };
  }
  return null;
}

/**
 * Paso 2: rol y acceso. Las cuentas UMECA viven en otra tabla, así que una cuenta existente no puede
 * cambiar entre personal interno y externo.
 */
export function validateUsuarioRol(
  input: UsuarioFormInput,
  original: UsuarioCuenta | null,
): UsuarioValidationFailure | null {
  if (!input.rol) return { field: 'rol', error: 'Selecciona el rol de la cuenta.' };
  if (original && tipoCuentaDeRol(input.rol) !== original.tipo) {
    return {
      field: 'rol',
      error:
        original.tipo === 'externo'
          ? 'Una cuenta externa de UMECA no puede convertirse en personal de SEMUJERES.'
          : 'Una cuenta de personal no puede convertirse en cuenta externa de UMECA.',
    };
  }
  return null;
}

export function usuarioFormFromCuenta(cuenta: UsuarioCuenta): UsuarioFormInput {
  return {
    ...INITIAL_USUARIO_FORM,
    nombre: cuenta.nombre,
    rol: cuenta.rol,
    activo: cuenta.activo,
  };
}
