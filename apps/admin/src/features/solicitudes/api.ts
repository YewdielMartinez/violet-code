import { useEffect, useLayoutEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ordenarColaAlertas,
  type AlertaCambioEvento,
  type EstadoAlerta,
} from '@/domain/models/Alerta';
import type { AlertaRealtimeStatus } from '@/domain/ports/AlertaRepository';
import { supabaseAlertaRepository } from '@/infrastructure/supabase/adapters/SupabaseAlertaRepository';

export type {
  AlertaCambioEvento,
  AlertaDetalleExtra,
  AlertaEstadoResult,
  ColaAlertaItem,
  EstadoAlerta,
  OrigenAlerta,
  PrioridadAlerta,
} from '@/domain/models/Alerta';

export {
  ESTADO_ALERTA_LABELS,
  ORIGEN_ALERTA_LABELS,
  PRIORIDAD_ALERTA_LABELS,
  ordenarColaAlertas,
  puedeAtenderAlertas,
  puedeVerColaAlertas,
  validarTransicionAlerta,
  validateObservacionesAlerta,
} from '@/domain/models/Alerta';

export function colaAlertasQueryKey(estados?: EstadoAlerta[] | null, limite = 50) {
  return ['alertas', 'cola', estados?.join(',') ?? 'all', limite] as const;
}

export function alertaDetalleQueryKey(alertaId: string) {
  return ['alertas', 'detalle', alertaId] as const;
}

export function useColaAlertas(
  estados: EstadoAlerta[] | null = ['nueva', 'tomada'],
  limite = 50,
  enabled = true,
) {
  return useQuery({
    queryKey: colaAlertasQueryKey(estados, limite),
    queryFn: () => supabaseAlertaRepository.listarCola(estados, limite),
    select: ordenarColaAlertas,
    enabled,
  });
}

export function useAlertaDetalle(alertaId: string | null, enabled = true) {
  return useQuery({
    queryKey: alertaDetalleQueryKey(alertaId ?? ''),
    queryFn: () => supabaseAlertaRepository.obtenerDetalle(alertaId!),
    enabled: Boolean(alertaId) && enabled,
  });
}

export function useTomarAlerta() {
  const qc = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: (alertaId: string) => supabaseAlertaRepository.tomar(alertaId),
    onSuccess: (_result, alertaId) => {
      void qc.invalidateQueries({ queryKey: ['alertas', 'cola'] });
      void qc.invalidateQueries({ queryKey: alertaDetalleQueryKey(alertaId) });
      void qc.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function useAtenderAlerta() {
  const qc = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: (vars: { alertaId: string; observaciones?: string | null }) =>
      supabaseAlertaRepository.atender(vars.alertaId, vars.observaciones),
    onSuccess: (_result, vars) => {
      void qc.invalidateQueries({ queryKey: ['alertas', 'cola'] });
      void qc.invalidateQueries({ queryKey: alertaDetalleQueryKey(vars.alertaId) });
      void qc.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export interface UseAlertasRealtimeOptions {
  enabled?: boolean;
  onNuevaAlerta?: (evento: AlertaCambioEvento) => void;
  onStatusChange?: (status: AlertaRealtimeStatus) => void;
}

/**
 * Mantiene sincronizada la cola de alertas mediante Supabase Realtime (`public.alerta`).
 * Invalida TanStack Query ante cualquier cambio y al reconectar tras una caída de red.
 */
export function useAlertasRealtime({
  enabled = true,
  onNuevaAlerta,
  onStatusChange,
}: UseAlertasRealtimeOptions = {}) {
  const qc = useQueryClient();
  const onNuevaAlertaRef = useRef(onNuevaAlerta);
  const onStatusChangeRef = useRef(onStatusChange);

  useLayoutEffect(() => {
    onNuevaAlertaRef.current = onNuevaAlerta;
    onStatusChangeRef.current = onStatusChange;
  }, [onNuevaAlerta, onStatusChange]);

  useEffect(() => {
    if (!enabled) return undefined;

    let subscribedOnce = false;

    const unsubscribe = supabaseAlertaRepository.suscribirCambios(
      (evento) => {
        void qc.invalidateQueries({ queryKey: ['alertas', 'cola'] });
        void qc.invalidateQueries({ queryKey: ['alerts'] });
        if (evento?.alertaId) {
          void qc.invalidateQueries({ queryKey: alertaDetalleQueryKey(evento.alertaId) });
        }
        if (evento?.eventType === 'INSERT') {
          onNuevaAlertaRef.current?.(evento);
        }
      },
      (status) => {
        onStatusChangeRef.current?.(status);
        if (status === 'SUBSCRIBED') {
          if (subscribedOnce) {
            void qc.invalidateQueries({ queryKey: ['alertas', 'cola'] });
            void qc.invalidateQueries({ queryKey: ['alerts'] });
          }
          subscribedOnce = true;
        }
      },
    );

    return unsubscribe;
  }, [enabled, qc]);
}

interface PostgresLikeError {
  code?: string;
  message?: string;
}

/** Traduce errores de RPC / RLS en la cola de alertas a mensajes claros en español. */
export function traducirErrorAlerta(error: unknown, fallback: string): string {
  const err = (error ?? {}) as PostgresLikeError;
  switch (err.code) {
    case '23505':
      return 'Esta alerta ya fue tomada por otra compañera.';
    case '42501':
      return 'No tienes permisos para atender alertas de la línea 24/7.';
    case '23514':
      return err.message || fallback;
    default:
      if (error instanceof Error && error.message.trim()) {
        return error.message;
      }
      return fallback;
  }
}
