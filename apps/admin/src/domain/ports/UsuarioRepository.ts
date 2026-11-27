import type { UsuarioCreateInput, UsuarioCuenta, UsuarioUpdateInput } from '../models/Usuario';

export type UsuarioErrorCode = 'correo_duplicado' | 'auth' | 'perfil' | 'permiso' | 'desconocido';

export class UsuarioError extends Error {
  readonly code: UsuarioErrorCode;

  constructor(code: UsuarioErrorCode, message: string) {
    super(message);
    this.name = 'UsuarioError';
    this.code = code;
  }
}

export interface UsuarioRepository {
  /** Personal (`empleado`) y cuentas externas (`usuario_externo`), ordenados por nombre. */
  listar(): Promise<UsuarioCuenta[]>;
  /** Crea la cuenta en Supabase Auth y su perfil (`empleado` o `usuario_externo`). */
  crear(input: UsuarioCreateInput): Promise<UsuarioCuenta>;
  /** Actualiza nombre, rol (y área derivada) y estado de una cuenta existente. */
  actualizar(cuenta: UsuarioCuenta, input: UsuarioUpdateInput): Promise<UsuarioCuenta>;
  /** Activa o desactiva el acceso sin borrar la cuenta (se conserva la trazabilidad de `creado_por`). */
  cambiarActivo(cuenta: UsuarioCuenta, activo: boolean): Promise<UsuarioCuenta>;
}
