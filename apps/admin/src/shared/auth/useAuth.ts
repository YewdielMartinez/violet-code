import { useSyncExternalStore } from 'react';
import { isAttentionRole, isSupervisor, ROLE_LABELS, type StaffRole, type StaffUser } from '@/domain/models/Auth';
import { sessionStore } from './session';

export function useAuth() {
  const { status, session } = useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot);
  return { status, user: session?.user ?? null };
}

export { isAttentionRole, isSupervisor, ROLE_LABELS, type StaffRole, type StaffUser };
