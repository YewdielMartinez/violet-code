import { useQuery } from '@tanstack/react-query';
import { supabaseAuthRepository } from '@/infrastructure/supabase/adapters/SupabaseAuthRepository';

export const MI_PERFIL_KEY = ['mi-perfil'] as const;

export function useMiPerfil() {
  return useQuery({
    queryKey: MI_PERFIL_KEY,
    queryFn: () => supabaseAuthRepository.miPerfil(),
    staleTime: 5 * 60_000,
  });
}
