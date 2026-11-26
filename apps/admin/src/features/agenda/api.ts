import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AgendaQuery,
  CitaCreateInput,
  EstadoCitaGestionable,
} from '@/domain/models/Cita';
import { supabaseCitaRepository } from '@/infrastructure/supabase/adapters/SupabaseCitaRepository';

export function agendaQueryKey(query: AgendaQuery) {
  return [
    'agenda',
    query.desde,
    query.hasta,
    query.areaId ?? null,
    query.estados?.join(',') ?? null,
  ] as const;
}

export function useAgenda(query: AgendaQuery, enabled = true) {
  return useQuery({
    queryKey: agendaQueryKey(query),
    queryFn: () => supabaseCitaRepository.listarAgenda(query),
    enabled: enabled && Boolean(query.desde && query.hasta),
  });
}

export function useCrearCita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CitaCreateInput) => supabaseCitaRepository.crear(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agenda'] });
    },
  });
}

export function useCambiarEstadoCita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      citaId: string;
      estado: EstadoCitaGestionable;
      motivo?: string | null;
    }) => supabaseCitaRepository.cambiarEstado(vars.citaId, vars.estado, vars.motivo),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agenda'] });
      void qc.invalidateQueries({ queryKey: ['agenda', 'urgencias'] });
    },
  });
}
