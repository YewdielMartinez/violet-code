import { useSyncExternalStore } from 'react';
import { sessionStore, type StaffRole } from './session';

export function useAuth() {
  const { status, session } = useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot);
  return { status, user: session?.user ?? null };
}

const SUPERVISORS: readonly StaffRole[] = ['admin', 'coordinacion'];

export const isSupervisor = (role: StaffRole | undefined) => role !== undefined && SUPERVISORS.includes(role);

export const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Administración',
  coordinacion: 'Coordinación',
  profesional: 'Profesional',
  recepcion: 'Recepción',
};
