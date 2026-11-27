import type { StaffRole } from './Auth';
import { MIN_CONTRASENA } from './Usuario';

/** Perfil de quien tiene la sesión iniciada (`get_mi_perfil`). */
export interface MiPerfil {
  id: string;
  tipo: 'empleado' | 'externo';
  nombre: string;
  correo: string;
  /** 10 dígitos o `null`. */
  telefono: string | null;
  rol: StaffRole;
  areaId: number | null;
  areaClave: string | null;
  areaNombre: string | null;
  /** Dependencia de las cuentas externas (`umeca`); `null` en el personal. */
  dependencia: string | null;
  activo: boolean;
  /** Claves de `tiene_permiso()` que son verdaderas para esta cuenta (vacío en UMECA). */
  permisos: string[];
  creadoEn: string;
}

/** Datos que la persona puede editar de su propio perfil. */
export interface MiPerfilEdicion {
  nombre: string;
  /** Texto libre del campo; se normaliza a 10 dígitos al validar. Vacío = sin teléfono. */
  telefono: string;
}

export interface MiPerfilGuardado {
  nombre: string;
  telefono: string | null;
}

export const NOMBRE_PERFIL_MAX = 120;
const TELEFONO_REGEX = /^[0-9]{10}$/;

/** Quita espacios, guiones, puntos y paréntesis (lo mismo que hace `actualizar_mi_perfil`). */
export function normalizarTelefono(raw: string): string {
  return raw.replace(/[\s().-]/g, '');
}

export type MiPerfilField = 'nombre' | 'telefono';

export interface MiPerfilValidationFailure {
  field: MiPerfilField;
  error: string;
}

export function validarMiPerfil(input: MiPerfilEdicion): MiPerfilValidationFailure | null {
  const nombre = input.nombre.trim();
  if (!nombre) return { field: 'nombre', error: 'Escribe tu nombre completo.' };
  if (nombre.length > NOMBRE_PERFIL_MAX) {
    return { field: 'nombre', error: `El nombre no puede pasar de ${NOMBRE_PERFIL_MAX} caracteres.` };
  }
  const telefono = normalizarTelefono(input.telefono);
  if (telefono && !TELEFONO_REGEX.test(telefono)) {
    return { field: 'telefono', error: 'El teléfono debe tener exactamente 10 dígitos.' };
  }
  return null;
}

export interface CambioContrasenaInput {
  actual: string;
  nueva: string;
  confirmar: string;
}

export type CambioContrasenaField = 'actual' | 'nueva' | 'confirmar';

export interface CambioContrasenaFailure {
  field: CambioContrasenaField;
  error: string;
}

/** Mismas reglas que `crear_cuenta_acceso`: mínimo 8 caracteres, con letras y números. */
export function validarCambioContrasena(input: CambioContrasenaInput): CambioContrasenaFailure | null {
  if (!input.actual) return { field: 'actual', error: 'Escribe tu contraseña actual.' };
  if (input.nueva.length < MIN_CONTRASENA) {
    return { field: 'nueva', error: `La nueva contraseña debe tener al menos ${MIN_CONTRASENA} caracteres.` };
  }
  if (!/[A-Za-z]/.test(input.nueva) || !/[0-9]/.test(input.nueva)) {
    return { field: 'nueva', error: 'La nueva contraseña debe combinar letras y números.' };
  }
  if (input.nueva === input.actual) {
    return { field: 'nueva', error: 'La nueva contraseña debe ser distinta a la actual.' };
  }
  if (input.nueva !== input.confirmar) {
    return { field: 'confirmar', error: 'Las contraseñas no coinciden.' };
  }
  return null;
}
