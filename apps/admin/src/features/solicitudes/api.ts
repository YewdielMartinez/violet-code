import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EstadoAlerta } from '@/domain/models/Alerta';
import { supabaseAlertaRepository } from '@/infrastructure/supabase/adapters/SupabaseAlertaRepository';

export function colaAlertasQueryKey(estados?: EstadoAlerta[] | null, limite = 50) {
  return ['alertas', 'cola', estados?.join(',') ?? 'all', limite] as const;
}

export function useColaAlertas(
  estados: EstadoAlerta[] | null = ['nueva', 'tomada'],
  limite = 50,
  enabled = true,
) {
  return useQuery({
    queryKey: colaAlertasQueryKey(estados, limite),
    queryFn: () => supabaseAlertaRepository.listarCola(estados, limite),
    enabled,
  });
}

export function useTomarAlerta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertaId: string) => supabaseAlertaRepository.tomar(alertaId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['alertas', 'cola'] });
    },
  });
}

export function useAtenderAlerta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { alertaId: string; observaciones?: string | null }) =>
      supabaseAlertaRepository.atender(vars.alertaId, vars.observaciones),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['alertas', 'cola'] });
    },
  });
}
