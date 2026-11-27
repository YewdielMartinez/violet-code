import {
  queryOptions,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { toast } from '@yewdiel21/motion-kit/react';
import { lineaTiempoQueryKey } from '@/features/seguimiento/queryKeys';
import type { AgresorInput } from '@/domain/models/Agresor';
import type { PrioridadNivel } from '@/domain/models/Cita';
import type { DomicilioUpdateInput } from '@/domain/models/Domicilio';
import type { EstudioSocioeconomicoRegistroInput } from '@/domain/models/EstudioSocioeconomico';
import type {
  CatalogoItem,
  CatalogosFicha,
  FichaCreateInput,
  FichaUpdateInput,
} from '@/domain/models/FichaRegistro';
import type { HistorialClinicoGuardarInput } from '@/domain/models/HistorialClinico';
import type { ExpedienteResumen, PersonaUpdateInput } from '@/domain/models/Persona';
import type { CatalogoNombre } from '@/domain/ports/SepomexRepository';
import type { CreatedFichaResult } from '@/domain/ports/FichaRepository';
import { supabaseAgresorRepository } from '@/infrastructure/supabase/adapters/SupabaseAgresorRepository';
import { supabaseExpedienteRepository } from '@/infrastructure/supabase/adapters/SupabaseExpedienteRepository';
import { supabaseFichaRepository } from '@/infrastructure/supabase/adapters/SupabaseFichaRepository';
import { supabaseHistorialClinicoRepository } from '@/infrastructure/supabase/adapters/SupabaseHistorialClinicoRepository';
import { supabaseSepomexRepository } from '@/infrastructure/supabase/adapters/SupabaseSepomexRepository';

export type { ExpedienteResumen, PersonaResumen, EstadoFicha } from '@/domain/models/Persona';
export {
  CURP_REGEX,
  ESTADO_FICHA_LABELS,
  detectSearchKind,
  isValidCurp,
  normalizeCurp,
} from '@/domain/models/Persona';
export type { PreRegistroMovil, VerificacionCurpResult } from '@/domain/models/PreRegistroMovil';
export { canLookupPreRegistro } from '@/domain/models/PreRegistroMovil';

/** Opciones compartidas del listado: cualquier consumidor (p. ej. Canalizaciones) reutiliza la misma caché. */
export function expedientesListQueryOptions(query?: string) {
  return queryOptions({
    queryKey: ['expedientes', 'list', query?.trim() ?? ''],
    queryFn: () => supabaseExpedienteRepository.list(query),
  });
}

export function useExpedientes(query?: string) {
  return useQuery(expedientesListQueryOptions(query));
}

export function expedienteByIdQueryOptions(fichaId: string) {
  return queryOptions({
    queryKey: ['expedientes', 'byId', fichaId],
    queryFn: () => supabaseExpedienteRepository.getById(fichaId),
  });
}

export function useExpedienteById(fichaId: string | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['expedientes', 'byId', fichaId ?? ''],
    queryFn: () =>
      fichaId ? supabaseExpedienteRepository.getById(fichaId) : Promise.resolve(null),
    enabled: Boolean(fichaId),
    initialData: () => {
      if (!fichaId) return undefined;
      const list = queryClient.getQueryData<ExpedienteResumen[]>(['expedientes', 'list', '']);
      return list?.find((item) => item.id === fichaId);
    },
  });
}

export function useVerifyCurp() {
  return useMutation({
    mutationFn: ({ curp, allowPreRegistroLookup }: { curp: string; allowPreRegistroLookup: boolean }) =>
      supabaseExpedienteRepository.verifyByCurp(curp, allowPreRegistroLookup),
  });
}

export function useRegisterConsult() {
  return useMutation({
    mutationFn: (fichaId: string) => supabaseExpedienteRepository.registerConsult(fichaId),
  });
}

const CATALOGOS_FICHA_STALE_TIME_MS = 10 * 60_000;

/**
 * Una sola consulta (y una sola entrada de caché) por catálogo institucional, compartida por la
 * Ficha Única, Persona agresora y Canalizaciones. Cada consumidor ordena/recorta con `select`.
 */
export function catalogoQueryOptions(catalogo: CatalogoNombre) {
  return queryOptions({
    queryKey: ['catalogos', catalogo],
    queryFn: () => supabaseSepomexRepository.listCatalogo(catalogo),
    staleTime: CATALOGOS_FICHA_STALE_TIME_MS,
  });
}

const CATALOGOS_FICHA: readonly CatalogoNombre[] = ['area', 'ocupacion', 'parentesco'];

function combineCatalogosFicha(results: UseQueryResult<CatalogoItem[]>[]) {
  const [areas, ocupaciones, parentescos] = results;
  const data: CatalogosFicha | undefined =
    areas.data && ocupaciones.data && parentescos.data
      ? { areas: areas.data, ocupaciones: ocupaciones.data, parentescos: parentescos.data }
      : undefined;
  return {
    data,
    isLoading: results.some((r) => r.isLoading),
    isError: results.some((r) => r.isError),
  };
}

export function useCatalogosFicha(enabled = true) {
  return useQueries({
    queries: CATALOGOS_FICHA.map((catalogo) => ({ ...catalogoQueryOptions(catalogo), enabled })),
    combine: combineCatalogosFicha,
  });
}

export function useAsentamientosSepomex(codigoPostal?: string, enabled = true) {
  const cp = codigoPostal?.trim() ?? '';
  return useQuery({
    queryKey: ['sepomex', 'asentamientos', cp],
    queryFn: () => supabaseSepomexRepository.listAsentamientos(cp || undefined),
    staleTime: 10 * 60_000,
    enabled,
  });
}

export function fichaDetailQueryOptions(fichaId: string) {
  return queryOptions({
    queryKey: ['expedientes', 'detail', fichaId],
    queryFn: () => supabaseFichaRepository.getDetail(fichaId),
  });
}

export function useFichaDetail(fichaId: string | null) {
  return useQuery({
    ...fichaDetailQueryOptions(fichaId ?? ''),
    enabled: Boolean(fichaId),
  });
}

export interface CreateFichaVariables extends FichaCreateInput {
  agresor?: Omit<AgresorInput, 'fichaId'> | null;
}

export interface CreateFichaOutcome extends CreatedFichaResult {
  agresorError?: string;
}

export function useCreateFicha() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ agresor, ...fichaInput }: CreateFichaVariables): Promise<CreateFichaOutcome> => {
      const created = await supabaseFichaRepository.createComplete(fichaInput);
      if (!agresor) return created;

      try {
        await supabaseAgresorRepository.crear({ ...agresor, fichaId: created.fichaId });
        return created;
      } catch (err) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : 'No se pudo guardar la persona agresora.';
        return { ...created, agresorError: message };
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expedientes'] });
    },
  });
}

export function useArchiveFicha() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fichaId, motivo }: { fichaId: string; motivo: string }) =>
      supabaseFichaRepository.archive(fichaId, motivo),
    onSuccess: (_data, { fichaId }) => {
      // Refleja «Archivado» al instante en los listados cacheados; la invalidación reconcilia con el servidor.
      queryClient.setQueriesData<ExpedienteResumen[]>(
        { queryKey: ['expedientes', 'list'] },
        (list) =>
          list?.map((item) => (item.id === fichaId ? { ...item, estado: 'archivado' } : item)),
      );
      void queryClient.invalidateQueries({ queryKey: ['expedientes'] });
      void queryClient.invalidateQueries({ queryKey: lineaTiempoQueryKey(fichaId) });
    },
  });
}

export function useReopenFicha() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fichaId, motivo }: { fichaId: string; motivo: string }) =>
      supabaseFichaRepository.reopen(fichaId, motivo),
    onSuccess: (estado, { fichaId }) => {
      // Refleja el nuevo estado (abierto / en seguimiento) al instante; la invalidación reconcilia con el servidor.
      queryClient.setQueriesData<ExpedienteResumen[]>(
        { queryKey: ['expedientes', 'list'] },
        (list) => list?.map((item) => (item.id === fichaId ? { ...item, estado } : item)),
      );
      void queryClient.invalidateQueries({ queryKey: ['expedientes'] });
      void queryClient.invalidateQueries({ queryKey: lineaTiempoQueryKey(fichaId) });
    },
  });
}

export function useDeactivateFicha() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fichaId: string) => supabaseFichaRepository.deactivate(fichaId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expedientes'] });
    },
  });
}

const OPTIMISTIC_CONFLICT_MESSAGE =
  'Este registro fue modificado por otra persona. Recarga los datos.';

export const EXPEDIENTE_ARCHIVADO_ERROR =
  'El expediente está archivado y no se puede modificar.';

/** Traduce errores `23514` / `42501` en escrituras de expediente (incluyendo bloqueo por archivo). */
export function formatErrorEscrituraExpediente(
  err: unknown,
  fallback: string,
  isArchivado = false,
): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? (err as { code?: unknown }).code
      : undefined;
  const message =
    err instanceof Error && err.message.trim() ? err.message : fallback;

  if (
    (code === '23514' || code === '42501') &&
    (isArchivado || /archivad|row-level security/i.test(message))
  ) {
    return EXPEDIENTE_ARCHIVADO_ERROR;
  }

  return message;
}

/** Maneja errores de mutación del expediente: ante conflicto optimista (`23505`) recarga el detalle. */
export function handleExpedienteMutationError(
  err: unknown,
  queryClient: QueryClient,
  fichaId: string,
  fallbackMessage: string,
): void {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? (err as { code?: unknown }).code
      : undefined;

  if (code === '23505') {
    toast(OPTIMISTIC_CONFLICT_MESSAGE, { tone: 'error' });
    void queryClient.invalidateQueries({ queryKey: ['expedientes', 'detail', fichaId] });
    void queryClient.invalidateQueries({ queryKey: ['expedientes', 'byId', fichaId] });
    void queryClient.invalidateQueries({ queryKey: ['expedientes', 'historial-clinico', fichaId] });
    return;
  }

  const message =
    err instanceof Error && err.message.trim() ? err.message : fallbackMessage;
  toast(message, { tone: 'error' });
}

export function useActualizarPersona(fichaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PersonaUpdateInput) => supabaseFichaRepository.actualizarPersona(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expedientes', 'detail', fichaId] });
      void queryClient.invalidateQueries({ queryKey: ['expedientes', 'byId', fichaId] });
      void queryClient.invalidateQueries({ queryKey: ['expedientes', 'list'] });
    },
  });
}

export function useActualizarFicha(fichaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FichaUpdateInput) => supabaseFichaRepository.actualizar(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expedientes', 'detail', fichaId] });
      void queryClient.invalidateQueries({ queryKey: ['expedientes', 'byId', fichaId] });
      void queryClient.invalidateQueries({ queryKey: ['expedientes', 'list'] });
    },
  });
}

export function useActualizarDomicilio(fichaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DomicilioUpdateInput) => supabaseFichaRepository.actualizarDomicilio(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expedientes', 'detail', fichaId] });
      void queryClient.invalidateQueries({ queryKey: ['expedientes', 'byId', fichaId] });
    },
  });
}

export function useRegistrarEstudio(fichaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EstudioSocioeconomicoRegistroInput) =>
      supabaseFichaRepository.registrarEstudioSocioeconomico(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expedientes', 'detail', fichaId] });
      void queryClient.invalidateQueries({ queryKey: ['expedientes', 'byId', fichaId] });
    },
  });
}

export function useCambiarPrioridad(fichaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prioridad: PrioridadNivel) =>
      supabaseFichaRepository.cambiarPrioridad(fichaId, prioridad),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expedientes', 'detail', fichaId] });
      void queryClient.invalidateQueries({ queryKey: ['expedientes', 'byId', fichaId] });
      void queryClient.invalidateQueries({ queryKey: ['expedientes', 'list'] });
    },
  });
}

export function useHistorialClinico(fichaId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['expedientes', 'historial-clinico', fichaId ?? ''],
    queryFn: () =>
      fichaId ? supabaseHistorialClinicoRepository.obtener(fichaId) : Promise.resolve(null),
    enabled: Boolean(fichaId) && enabled,
  });
}

export function useGuardarHistorialClinico(fichaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: HistorialClinicoGuardarInput) =>
      supabaseHistorialClinicoRepository.guardar(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['expedientes', 'historial-clinico', fichaId],
      });
    },
  });
}
