import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { isAttentionRole, isSupervisor, type StaffRole } from '@/domain/models/Auth';
import type { CatalogoItem } from '@/domain/models/FichaRegistro';
import { isValidCurp, normalizeCurp } from '@/domain/models/Persona';
import { supabaseExpedienteRepository } from '@/infrastructure/supabase/adapters/SupabaseExpedienteRepository';
import { supabaseSepomexRepository } from '@/infrastructure/supabase/adapters/SupabaseSepomexRepository';

export interface PersonaOpcion {
  id: string;
  nombre: string;
  /** Folio y CURP (solo si el rol puede verlos). */
  detalle: string | null;
}

export const MIN_TERMINO_BUSQUEDA = 3;

/**
 * `buscar_expedientes` exige `expediente.ver` (Dirección y áreas de atención). Recepción no lo tiene y,
 * desde la migración 29, tampoco lee `persona`: solo puede resolver una persona con la CURP exacta
 * (`verificar_curp`, que además deja rastro en bitácora).
 */
export function puedeBuscarPorNombre(role: StaffRole | undefined): boolean {
  return isSupervisor(role) || isAttentionRole(role);
}

/** `true` cuando el término ya se puede consultar (≥ 3 caracteres; para Recepción, una CURP completa). */
export function terminoBuscable(term: string, porNombre: boolean): boolean {
  const clean = term.trim();
  return porNombre ? clean.length >= MIN_TERMINO_BUSQUEDA : isValidCurp(clean);
}

async function buscar(term: string, porNombre: boolean): Promise<PersonaOpcion[]> {
  if (porNombre) {
    const items = await supabaseExpedienteRepository.list(term.trim());
    const seen = new Set<string>();
    const out: PersonaOpcion[] = [];
    for (const item of items) {
      if (item.estado === 'archivado' || seen.has(item.persona.id)) continue;
      seen.add(item.persona.id);
      out.push({
        id: item.persona.id,
        nombre: item.persona.nombreCompleto,
        detalle: [item.folio, item.persona.curp].filter(Boolean).join(' · ') || null,
      });
    }
    return out;
  }

  const result = await supabaseExpedienteRepository.verifyByCurp(normalizeCurp(term), false);
  if (result.kind === 'expediente_existente' && result.expediente.persona.id) {
    return [{ id: result.expediente.persona.id, nombre: result.expediente.persona.nombreCompleto, detalle: null }];
  }
  if (result.kind === 'persona_sin_ficha' && result.persona.id) {
    return [{ id: result.persona.id, nombre: result.persona.nombreCompleto, detalle: null }];
  }
  return [];
}

export function usePersonaSearch(term: string, porNombre: boolean) {
  const clean = term.trim();
  const key = porNombre ? clean.toLowerCase() : normalizeCurp(clean);
  return useQuery({
    queryKey: ['personas', 'buscar-cita', porNombre ? 'nombre' : 'curp', key],
    queryFn: () => buscar(clean, porNombre),
    enabled: terminoBuscable(clean, porNombre),
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
