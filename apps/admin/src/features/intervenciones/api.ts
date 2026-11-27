import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotaPrivadaCreateInput, NotaPrivadaUpdateInput } from '@/domain/models/NotaPrivada';
import { supabaseSeguimientoRepository } from '@/infrastructure/supabase/adapters/SupabaseSeguimientoRepository';
import { supabaseSepomexRepository } from '@/infrastructure/supabase/adapters/SupabaseSepomexRepository';

export { useAgenda, useCambiarEstadoCita } from '@/features/agenda/api';
export { useLineaTiempo, useRegistrarSeguimiento } from '@/features/seguimiento/api';

const CATALOGO_STALE_MS = 10 * 60_000;

export const INTERVENCIONES_KEYS = {
  tiposAtencion: (areaId: number | null) => ['catalogos', 'tipo_atencion', areaId] as const,
  contexto: (personaId: string) => ['intervenciones', 'contexto', personaId] as const,
  notas: (fichaId: string) => ['intervenciones', 'notas', fichaId] as const,
  // Misma clave que la Ficha Única para compartir la caché del catálogo.
  ocupaciones: () => ['catalogos', 'ocupacion'] as const,
  asentamientos: (cp: string) => ['sepomex', 'asentamientos', cp] as const,
};

export function useTiposAtencion(areaId: number | null, enabled = true) {
  return useQuery({
    queryKey: INTERVENCIONES_KEYS.tiposAtencion(areaId),
    queryFn: () => supabaseSeguimientoRepository.listarTiposAtencion(areaId as number),
    enabled: enabled && areaId !== null,
    staleTime: CATALOGO_STALE_MS,
  });
}

export function useOcupaciones(enabled = true) {
  return useQuery({
    queryKey: INTERVENCIONES_KEYS.ocupaciones(),
    queryFn: () => supabaseSepomexRepository.listCatalogo('ocupacion'),
    enabled,
    staleTime: CATALOGO_STALE_MS,
  });
}

/** Asentamientos de Ahome para un CP de 5 dígitos (catálogo local, sin red externa). */
export function useAsentamientosPorCp(codigoPostal: string) {
  const cp = codigoPostal.trim();
  return useQuery({
    queryKey: INTERVENCIONES_KEYS.asentamientos(cp),
    queryFn: () => supabaseSepomexRepository.listAsentamientos(cp),
    enabled: /^[0-9]{5}$/.test(cp),
    staleTime: CATALOGO_STALE_MS,
  });
}

export function useContextoHoja(personaId: string | null, enabled = true) {
  return useQuery({
    queryKey: INTERVENCIONES_KEYS.contexto(personaId ?? ''),
    queryFn: () => supabaseSeguimientoRepository.getContextoHoja(personaId as string),
    enabled: enabled && Boolean(personaId),
  });
}

export function useNotasPrivadas(fichaId: string, enabled = true) {
  return useQuery({
    queryKey: INTERVENCIONES_KEYS.notas(fichaId),
    queryFn: () => supabaseSeguimientoRepository.listarNotas(fichaId),
    enabled: enabled && Boolean(fichaId),
  });
}

function useInvalidateNotas(fichaId: string) {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: INTERVENCIONES_KEYS.notas(fichaId) });
}

export function useCrearNotaPrivada(fichaId: string) {
  const onSuccess = useInvalidateNotas(fichaId);
  return useMutation({
    mutationFn: (input: NotaPrivadaCreateInput) => supabaseSeguimientoRepository.crearNota(input),
    retry: false,
    onSuccess,
  });
}

export function useActualizarNotaPrivada(fichaId: string) {
  const onSuccess = useInvalidateNotas(fichaId);
  return useMutation({
    mutationFn: (input: NotaPrivadaUpdateInput) => supabaseSeguimientoRepository.actualizarNota(input),
    retry: false,
    onSuccess,
  });
}

export function useArchivarNotaPrivada(fichaId: string) {
  const onSuccess = useInvalidateNotas(fichaId);
  return useMutation({
    mutationFn: (id: string) => supabaseSeguimientoRepository.archivarNota(id),
    retry: false,
    onSuccess,
  });
}

interface PostgresLikeError {
  code?: string;
  message?: string;
}

/** Traduce los códigos estándar (`23505`, `42501`, `23514`, `P0001`) a mensajes para la usuaria. */
export function traducirErrorIntervencion(error: unknown, fallback: string): string {
  const err = (error ?? {}) as PostgresLikeError;
  switch (err.code) {
    case '23505':
      return 'Esta cita ya tiene una hoja de seguimiento registrada.';
    case '42501':
      return 'Tu rol o área no tiene permiso para esta acción.';
    case '23514':
    case 'P0001':
      return err.message || fallback;
    default:
      return fallback;
  }
}
