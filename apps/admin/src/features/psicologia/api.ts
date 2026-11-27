import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RegistroClinicoInput } from '@/domain/models/HistorialClinico';
import { supabaseHistorialClinicoRepository as repository } from '@/infrastructure/supabase/adapters/SupabaseHistorialClinicoRepository';

const queryKey = (fichaId: string, empleadoId: string) =>
  ['historial-clinico', empleadoId, fichaId] as const;

export function useExpedienteClinico(fichaId: string, empleadoId: string) {
  return useQuery({
    queryKey: queryKey(fichaId, empleadoId),
    gcTime: 0,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const expediente = await repository.consultar(fichaId, signal);
      if (expediente && !signal.aborted) {
        await repository.registrarConsulta(fichaId, expediente.historial?.id);
      }
      return expediente;
    },
  });
}

export function useGuardarRegistroClinico(fichaId: string, empleadoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    gcTime: 0,
    networkMode: 'always',
    mutationFn: (input: RegistroClinicoInput) => repository.guardar(fichaId, empleadoId, input),
    onSettled: (_data, error) =>
      queryClient.invalidateQueries({
        queryKey: queryKey(fichaId, empleadoId),
        // Una escritura fallida/ambigua puede haberse aplicado. Refrescar si la vista sigue abierta.
        refetchType: error && !navigator.onLine ? 'none' : 'active',
      }),
  });
}
