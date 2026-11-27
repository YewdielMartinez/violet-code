import type { AuthSession, StaffUser, UmecaCita } from '../models/Auth';

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
  miPerfil(): Promise<StaffUser>;
  getUmecaCitas(): Promise<UmecaCita[]>;
}
