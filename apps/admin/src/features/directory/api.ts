import { useQuery } from '@tanstack/react-query';
import { CATEGORIA_LABELS, type CategoriaInstitucion, type DirectorioInstitucion } from '@/domain/models/Directorio';
import { supabaseDirectorioRepository } from '@/infrastructure/supabase/adapters/SupabaseDirectorioRepository';

export { CATEGORIA_LABELS, type CategoriaInstitucion, type DirectorioInstitucion };

/** Directorio institucional desde Supabase (React Query deduplica consultas). */
export function useDirectory<T = DirectorioInstitucion[]>(
  categoria?: CategoriaInstitucion,
  select?: (entries: DirectorioInstitucion[]) => T,
) {
  return useQuery({
    queryKey: ['directory', categoria ?? 'all'],
    queryFn: () => supabaseDirectorioRepository.listar(categoria),
    select,
  });
}
