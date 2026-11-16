import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

// Espejo de VioletCode.Modules.Audit.Endpoints.AuditEventDto
export interface AuditEvent {
  id: string;
  occurredAt: string;
  action: string;
  resource: string;
  actorName: string | null;
  details: string | null;
}

export const useRecentActivity = (enabled: boolean) =>
  useQuery({
    queryKey: ['audit', 'recent'],
    queryFn: () => api<AuditEvent[]>('/api/audit/events?take=12'),
    enabled,
    refetchInterval: 30_000,
  });
