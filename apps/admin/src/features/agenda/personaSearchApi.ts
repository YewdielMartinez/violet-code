import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { CatalogoItem } from '@/domain/models/FichaRegistro';
import { supabaseCitaRepository } from '@/infrastructure/supabase/adapters/SupabaseCitaRepository';
import { supabaseSepomexRepository } from '@/infrastructure/supabase/adapters/SupabaseSepomexRepository';

export interface PersonaOpcion {
  /** `persona.id` (lo que recibe `cita.persona_id`). */
  id: string;
  nombre: string;
  /** CURP enmascarada. */
  curp: string | null;
  folio: string | null;
}

export const MIN_TERMINO_BUSQUEDA = 3;
export const LIMITE_RESULTADOS = 10;

/** `true` cuando el término ya se puede consultar (≥ 3 caracteres). */
export function terminoBuscable(term: string): boolean {
  return term.trim().length >= MIN_TERMINO_BUSQUEDA;
}

/**
 * Búsqueda única para todos los roles que agendan: el RPC `buscar_personas_agenda` (permiso `agenda.crear`)
 * localiza por nombre/apellidos (sin acentos) o prefijo de CURP, excluye fichas archivadas y solo devuelve la
 * CURP enmascarada.
 */
async function buscar(term: string): Promise<PersonaOpcion[]> {
  const items = await supabaseCitaRepository.buscarPersonas(term, LIMITE_RESULTADOS);
  const seen = new Set<string>();
  const out: PersonaOpcion[] = [];
  for (const item of items) {
    if (seen.has(item.personaId)) continue;
    seen.add(item.personaId);
    out.push({
      id: item.personaId,
      nombre: item.nombreCompleto,
      curp: item.curpEnmascarada,
      folio: item.folio || null,
    });
  }
  return out;
}

export function usePersonaSearch(term: string) {
  const clean = term.trim();
  return useQuery({
    queryKey: ['personas', 'buscar-cita', clean.toLowerCase()],
    queryFn: () => buscar(clean),
    enabled: terminoBuscable(clean),
    staleTime: 30_000,
    retry: false,
    placeholderData: keepPreviousData,
  });
}

export function useAreasCita() {
  return useQuery<CatalogoItem[]>({
    queryKey: ['catalogos', 'area'],
    queryFn: () => supabaseSepomexRepository.listCatalogo('area'),
    staleTime: 10 * 60_000,
  });
}
