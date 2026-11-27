import type { AuthSession, UmecaCita } from '../models/Auth';
import type { MiPerfil, MiPerfilEdicion, MiPerfilGuardado } from '../models/Perfil';

export class AuthError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface AuthRepository {
  login(email: string, password: string): Promise<AuthSession>;
  logout(): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  onAuthStateChange(listener: (session: AuthSession | null) => void): () => void;
  getUmecaCitas(): Promise<UmecaCita[]>;
  /** Perfil propio con rol, área/dependencia y permisos efectivos (`get_mi_perfil`). */
  miPerfil(): Promise<MiPerfil>;
  /** Edita solo nombre y teléfono propios (`actualizar_mi_perfil`). */
  actualizarMiPerfil(input: MiPerfilEdicion): Promise<MiPerfilGuardado>;
  /** Re-valida la contraseña actual y establece la nueva (Supabase Auth). */
  cambiarContrasena(actual: string, nueva: string): Promise<void>;
}
