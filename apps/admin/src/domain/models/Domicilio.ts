import type { Database } from '@/infrastructure/supabase/database.types';

export type ZonaGeografica = Database['public']['Enums']['zona_geografica'];

export interface AsentamientoSepomex {
  id: number;
  nombre: string;
  tipoAsentamiento: string;
  codigoPostal: string;
  municipio: string;
  estado: string;
  localidad: string | null;
}

export interface DomicilioInput {
  /** Presente cuando el asentamiento pertenece al catálogo SEPOMEX de Ahome. */
  asentamientoId: number | null;
  /** Código postal de respaldo (5 dígitos) solo para domicilios fuera de Ahome (`asentamientoId === null`). */
  codigoPostalForaneo: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
  referencias: string;
  zona: ZonaGeografica | '';
}

export interface DomicilioDetalle {
  id: string;
  asentamientoId: number | null;
  asentamientoNombre: string | null;
  codigoPostal: string | null;
  calle: string | null;
  numeroExterior: string | null;
  numeroInterior: string | null;
  referencias: string | null;
  zona: ZonaGeografica | null;
}

export const INITIAL_DOMICILIO_INPUT: DomicilioInput = {
  asentamientoId: null,
  codigoPostalForaneo: '',
  calle: '',
  numeroExterior: '',
  numeroInterior: '',
  referencias: '',
  zona: 'urbana',
};

const CP_REGEX = /^[0-9]{5}$/;

/**
 * Valida la regla `CHECK (asentamiento_id is null or codigo_postal is null)` de `01_base.sql`
 * y asegura al menos una referencia territorial o de calle.
 */
export function validateDomicilio(input: DomicilioInput): string | null {
  const cp = input.codigoPostalForaneo.trim();
  if (input.asentamientoId !== null && cp.length > 0) {
    return 'No combines asentamiento local de Ahome con código postal foráneo.';
  }
  if (input.asentamientoId === null) {
    if (!cp) {
      return 'Selecciona un asentamiento de Ahome o captura un código postal foráneo de 5 dígitos.';
    }
    if (!CP_REGEX.test(cp)) {
      return 'El código postal debe tener exactamente 5 dígitos.';
    }
  }
  if (!input.calle.trim()) {
    return 'Captura el nombre de la calle o referencia principal del domicilio.';
  }
  return null;
}
