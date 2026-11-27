import type { Database } from '@/infrastructure/supabase/database.types';

export type EstadoFicha = Database['public']['Enums']['estado_ficha'];
export type SexoBiologico = Database['public']['Enums']['sexo_biologico'];

export const ESTADO_FICHA_LABELS: Record<EstadoFicha, string> = {
  abierto: 'Abierto',
  en_seguimiento: 'En seguimiento',
  cerrado: 'Cerrado',
  archivado: 'Archivado',
};

/** Expresión regular oficial de CURP alineada con la restricción CHECK de `public.persona`. */
export const CURP_REGEX =
  /^[A-Z][AEIOUX][A-Z]{2}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[HM](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z][0-9]$/;

export type SearchKind = 'curp' | 'folio' | 'nombre';

export interface PersonaResumen {
  id: string;
  curp: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  nombreCompleto: string;
  sexo: SexoBiologico;
  fechaNacimiento: string;
  entidadNacimiento: string;
  celular: string | null;
}

export interface ExpedienteResumen {
  id: string;
  folio: string;
  estado: EstadoFicha;
  creadoEn: string;
  actualizadoEn: string;
  enListaUrgencias: boolean;
  persona: PersonaResumen;
}

export function normalizeCurp(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidCurp(raw: string): boolean {
  return CURP_REGEX.test(normalizeCurp(raw));
}

export function detectSearchKind(raw: string): SearchKind {
  const clean = raw.trim().toUpperCase();
  if (CURP_REGEX.test(clean)) return 'curp';
  if (/^SEM-\d{4}-\d{1,6}$/.test(clean)) return 'folio';
  return 'nombre';
}

export function formatFullName(
  nombres: string,
  apellidoPaterno: string,
  apellidoMaterno?: string | null,
): string {
  return [nombres, apellidoPaterno, apellidoMaterno]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
}

export interface PersonaUpdateInput {
  personaId: string;
  actualizadoEn: string;
  nombres?: string | null;
  apellidoPaterno?: string | null;
  apellidoMaterno?: string | null;
  celular?: string | null;
  escolaridad?: Database['public']['Enums']['escolaridad_nivel'] | null;
  discapacidad?: string | null;
  grupoEtnico?: string | null;
  religion?: string | null;
}

export interface PersonaActualizada {
  id: string;
  curp: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  sexo: SexoBiologico;
  fechaNacimiento: string;
  entidadNacimiento: string;
  celular: string | null;
  escolaridad: Database['public']['Enums']['escolaridad_nivel'] | null;
  discapacidad: string | null;
  grupoEtnico: string | null;
  religion: string | null;
  actualizadoEn: string;
}
