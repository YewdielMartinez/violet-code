import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AgresorInput } from '@/domain/models/Agresor';
import type { TablaConsultaAgresor } from '@/domain/ports/AgresorRepository';
import { supabaseAgresorRepository } from '@/infrastructure/supabase/adapters/SupabaseAgresorRepository';

export type {
  Agresor,
  AgresorInput,
  AgresorValidationField,
  AsentamientoOpcion,
  CatalogoOpcion,
  TipoArma,
  TipoDroga,
} from '@/domain/models/Agresor';
export {
  DROGA_LABELS,
  TIPO_ARMA_LABELS,
  TIPOS_ARMA,
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

export function useParentescos() {
  return useQuery({
    queryKey: ['catalogos', 'parentesco'],
    queryFn: () => supabaseAgresorRepository.listarParentescos(),
    staleTime: CATALOG_STALE_TIME_MS,
  });
}

export function useOcupaciones() {
  return useQuery({
    queryKey: ['catalogos', 'ocupacion'],
    queryFn: () => supabaseAgresorRepository.listarOcupaciones(),
    staleTime: CATALOG_STALE_TIME_MS,
  });
}

export function useAsentamientosAhome() {
  return useQuery({
    queryKey: ['catalogos', 'asentamiento', 'ahome'],
    queryFn: () => supabaseAgresorRepository.listarAsentamientosAhome(),
    staleTime: CATALOG_STALE_TIME_MS,
  });
}
