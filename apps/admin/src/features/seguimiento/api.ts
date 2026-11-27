import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SeguimientoCreateInput } from '@/domain/models/Seguimiento';
import { supabaseSeguimientoRepository } from '@/infrastructure/supabase/adapters/SupabaseSeguimientoRepository';

import { lineaTiempoQueryKey } from './queryKeys';

export { LINEA_TIEMPO_QUERY_ROOT, lineaTiempoQueryKey } from './queryKeys';

export function useLineaTiempo(fichaId: string, enabled = true) {
  return useQuery({
    queryKey: lineaTiempoQueryKey(fichaId),
    queryFn: () => supabaseSeguimientoRepository.getLineaTiempo(fichaId),
    enabled: enabled && Boolean(fichaId),
  });
}

export function useRegistrarSeguimiento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SeguimientoCreateInput) => supabaseSeguimientoRepository.registrar(input),
    onSuccess: (_result, variables) => {
      void qc.invalidateQueries({ queryKey: lineaTiempoQueryKey(variables.fichaId) });
      void qc.invalidateQueries({ queryKey: ['expedientes'] });
      void qc.invalidateQueries({ queryKey: ['agenda'] });
    },
  });
}
