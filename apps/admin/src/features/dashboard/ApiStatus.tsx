import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

/** Indicador de conexión con Violet Code Core (GET /health). */
export function ApiStatus() {
  const { isSuccess, isError } = useQuery({
    queryKey: ['health'],
    queryFn: () => api<{ status: string }>('/health'),
    refetchInterval: 15_000,
  });

  const [label, dot] = isSuccess
    ? ['API conectada', 'bg-primary']
    : isError
      ? ['API sin conexión', 'bg-error']
      : ['Conectando…', 'bg-outline'];

  return (
    <span role="status" className="inline-flex items-center gap-2 rounded-full bg-surface-container px-3 py-1.5 text-sm text-on-surface-variant">
      <span aria-hidden className={`size-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
