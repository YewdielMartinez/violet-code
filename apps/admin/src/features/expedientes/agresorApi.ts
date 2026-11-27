import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AgresorInput, CatalogoOpcion } from '@/domain/models/Agresor';
import type { TablaConsultaAgresor } from '@/domain/ports/AgresorRepository';
import { supabaseAgresorRepository } from '@/infrastructure/supabase/adapters/SupabaseAgresorRepository';
import { catalogoQueryOptions } from './api';

export type {
  Agresor,
  AgresorInput,
  AgresorValidationField,
  AsentamientoOpcion,
  CatalogoOpcion,
  TipoDroga,
} from '@/domain/models/Agresor';
export {
  DROGA_LABELS,
  TIPOS_DROGA,
  formatAgresorNombre,
  puedeAccederAgresor,
  validarAgresor,
} from '@/domain/models/Agresor';

const CATALOG_STALE_TIME_MS = 1000 * 60 * 30;

export function agresoresQueryKey(fichaId: string) {
  return ['expedientes', 'agresores', fichaId] as const;
}

export function useAgresores(fichaId: string | null | undefined) {
  return useQuery({
    queryKey: ['expedientes', 'agresores', fichaId ?? ''],
    queryFn: () => supabaseAgresorRepository.listarPorFicha(fichaId!),
    enabled: Boolean(fichaId),
  });
}

export interface GuardarAgresorVars {
  id?: string;
  input: AgresorInput;
}

export function useGuardarAgresor(fichaId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    retry: false,
    mutationFn: ({ id, input }: GuardarAgresorVars) =>
      id ? supabaseAgresorRepository.actualizar(id, input) : supabaseAgresorRepository.crear(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: agresoresQueryKey(fichaId) });
    },
  });
}

export function useRegistrarConsultaAgresor() {
  return useMutation({
    retry: false,
    mutationFn: ({ tabla, registroId }: { tabla: TablaConsultaAgresor; registroId: string }) =>
      supabaseAgresorRepository.registrarConsulta(tabla, registroId),
  });
}

/**
 * Registra en `bitacora_acceso` la apertura de la pestaña de persona agresora una sola vez
 * por `fichaId`, protegido contra la doble invocación de efectos en React StrictMode (`RF-05`, `RF-22`).
 */
export function useRegistrarConsultaTabAgresor(fichaId: string) {
  const { mutate } = useRegistrarConsultaAgresor();
  const registeredFichaRef = useRef<string | null>(null);

  useEffect(() => {
    if (!fichaId || registeredFichaRef.current === fichaId) return;
    registeredFichaRef.current = fichaId;
    mutate({ tabla: 'ficha_registro', registroId: fichaId });
  }, [fichaId, mutate]);
}

/** El formulario de agresor muestra los catálogos en orden de id (la caché compartida viene por nombre). */
function sortById(rows: CatalogoOpcion[]): CatalogoOpcion[] {
  return [...rows].sort((a, b) => a.id - b.id);
}

export function useParentescos() {
  return useQuery({
    ...catalogoQueryOptions('parentesco'),
    staleTime: CATALOG_STALE_TIME_MS,
    select: sortById,
  });
}

export function useOcupaciones() {
  return useQuery({
    ...catalogoQueryOptions('ocupacion'),
    staleTime: CATALOG_STALE_TIME_MS,
    select: sortById,
  });
}

export function useAsentamientosAhome() {
  return useQuery({
    queryKey: ['catalogos', 'asentamiento', 'ahome'],
    queryFn: () => supabaseAgresorRepository.listarAsentamientosAhome(),
    staleTime: CATALOG_STALE_TIME_MS,
  });
}
