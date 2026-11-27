import type { Database } from '@/infrastructure/supabase/database.types';

export type DestinoDerivacion = Database['public']['Enums']['destino_derivacion'];
export type EstadoDerivacion = Database['public']['Enums']['estado_derivacion'];

export const DESTINO_LABELS: Record<DestinoDerivacion, string> = {
  trabajo_social: 'Trabajo Social (Interna)',
  psicologia: 'Psicología (Interna)',
  juridico: 'Jurídico (Interna)',
  fiscalia: 'Fiscalía / Ministerio Público',
  refugio: 'Refugio',
  capacitacion: 'Capacitación / Empoderamiento',
  otra_institucion: 'Otra institución externa',
};

export const ESTADO_DERIVACION_LABELS: Record<EstadoDerivacion, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  concluida: 'Concluida',
  cancelada: 'Cancelada',
};

export const DESTINOS_DERIVACION: readonly DestinoDerivacion[] = [
  'psicologia',
  'juridico',
  'trabajo_social',
  'fiscalia',
  'refugio',
  'capacitacion',
  'otra_institucion',
];

export const ESTADOS_DERIVACION: readonly EstadoDerivacion[] = [
  'pendiente',
  'en_proceso',
  'concluida',
  'cancelada',
];

export function isInternalDestino(destino: DestinoDerivacion): boolean {
  return destino === 'trabajo_social' || destino === 'psicologia' || destino === 'juridico';
}

export interface DerivacionItem {
  id: string;
  fichaId: string;
  folio: string;
  usuariaNombre: string;
  areaOrigenId: number | null;
  areaOrigenNombre: string | null;
  areaDestinoId: number | null;
  areaDestinoNombre: string | null;
  institucionId: number | null;
  institucionNombre: string | null;
  institucionOtra: string | null;
  destino: DestinoDerivacion;
  motivo: string | null;
  fechaDerivacion: string;
  estado: EstadoDerivacion;
  creadoEn: string;
}

export interface DerivacionCreateInput {
  fichaId: string;
  areaOrigenId: number | null;
  destino: DestinoDerivacion;
  areaDestinoId: number | null;
  institucionId: number | null;
  institucionOtra: string;
  motivo: string;
}

/**
 * Valida las reglas `CHECK` de `public.derivacion` (`04_ficha.sql`):
 * - Destino interno: `areaDestinoId` obligatorio, sin `institucionId` ni `institucionOtra`.
 * - Destino externo: `areaDestinoId` nulo, `institucionId` e `institucionOtra` excluyentes.
 * - `otra_institucion`: exige `institucionId` o `institucionOtra`.
 */
export function validateDerivacion(input: DerivacionCreateInput): string | null {
  if (!input.fichaId) {
    return 'Selecciona el expediente a canalizar.';
  }
  if (!input.motivo.trim()) {
    return 'Describe el motivo de la canalización.';
  }

  const internal = isInternalDestino(input.destino);
  const otra = input.institucionOtra.trim();

  if (internal) {
    if (input.areaDestinoId === null) {
      return 'El área interna de destino es obligatoria.';
    }
    if (input.institucionId !== null || otra.length > 0) {
      return 'Una canalización interna no debe incluir institución externa.';
    }
    return null;
  }

  if (input.areaDestinoId !== null) {
    return 'Una canalización externa no debe asignar área interna.';
  }
  if (input.institucionId !== null && otra.length > 0) {
    return 'Elige una institución del directorio o escribe otra, pero no ambas.';
  }
  if (input.destino === 'otra_institucion' && input.institucionId === null && !otra) {
    return 'Especifica la institución externa de destino.';
  }

  return null;
}

const VALID_TRANSITIONS: Record<EstadoDerivacion, readonly EstadoDerivacion[]> = {
  pendiente: ['en_proceso', 'cancelada'],
  en_proceso: ['concluida', 'cancelada'],
  concluida: [],
  cancelada: [],
};

/**
 * Valida si una derivación puede cambiar de `actual` a `siguiente`:
 * - `pendiente` -> `en_proceso` | `cancelada`
 * - `en_proceso` -> `concluida` | `cancelada`
 * - `concluida` y `cancelada` son estados terminales.
 */
export function validarTransicionDerivacion(
  actual: EstadoDerivacion,
  siguiente: EstadoDerivacion,
): string | null {
  if (actual === siguiente) {
    return 'La derivación ya se encuentra en ese estado.';
  }
  if (!VALID_TRANSITIONS[actual].includes(siguiente)) {
    return `Transición de estado no permitida: ${ESTADO_DERIVACION_LABELS[actual]} -> ${ESTADO_DERIVACION_LABELS[siguiente]}.`;
  }
  return null;
}
