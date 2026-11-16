import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

// Espejo de VioletCode.Modules.Catalogs.Endpoints.DirectoryEntryDto
export type EntryKind = 'Institution' | 'VioletPoint';

export interface DirectoryEntry {
  id: string;
  kind: EntryKind;
  name: string;
  description: string | null;
  phone: string | null;
  address: string | null;
  schedule: string | null;
  latitude: number | null;
  longitude: number | null;
  isEmergency: boolean;
}

/**
 * Directorio desde Core. Varias pantallas pueden llamarlo: React Query deduplica la petición.
 * `select` (opcional, estable/fuera del componente) deriva datos sin re-renderizar de más.
 */
export function useDirectory<T = DirectoryEntry[]>(kind?: EntryKind, select?: (entries: DirectoryEntry[]) => T) {
  return useQuery({
    queryKey: ['directory', kind ?? 'all'],
    queryFn: () => api<DirectoryEntry[]>(`/api/catalogs/directory${kind ? `?kind=${kind}` : ''}`),
    select,
  });
}
