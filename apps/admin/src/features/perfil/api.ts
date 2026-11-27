import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MiPerfil, MiPerfilEdicion } from '@/domain/models/Perfil';
import { supabaseAuthRepository } from '@/infrastructure/supabase/adapters/SupabaseAuthRepository';
import { updateSessionUser } from '@/shared/auth/session';

export * from '@/domain/models/Perfil';

export const MI_PERFIL_KEY = ['mi-perfil'] as const;

export function miPerfilQueryOptions() {
  return queryOptions({
    queryKey: MI_PERFIL_KEY,
    queryFn: () => supabaseAuthRepository.miPerfil(),
    staleTime: 60_000,
  });
}

/** `enabled: false` evita pedir el perfil hasta que se muestre la sección «Cuenta» de Configuración. */
export function useMiPerfil({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ ...miPerfilQueryOptions(), enabled });
}

/** Guarda nombre y teléfono; refresca `['mi-perfil']` y el nombre que muestra el nav (sesión). */
export function useActualizarMiPerfil() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MiPerfilEdicion) => supabaseAuthRepository.actualizarMiPerfil(input),
    onSuccess: (saved) => {
      queryClient.setQueryData<MiPerfil>(MI_PERFIL_KEY, (prev) =>
        prev ? { ...prev, nombre: saved.nombre, telefono: saved.telefono } : prev,
      );
      updateSessionUser({ displayName: saved.nombre });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: MI_PERFIL_KEY }),
  });
}

export function useCambiarContrasena() {
  return useMutation({
    mutationFn: ({ actual, nueva }: { actual: string; nueva: string }) =>
      supabaseAuthRepository.cambiarContrasena(actual, nueva),
  });
}

export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}
