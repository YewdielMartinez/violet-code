import type { Database } from '@/infrastructure/supabase/database.types';

/**
 * Consumo de drogas (persona usuaria y persona agresora).
 *
 * Reglas de producto: selección múltiple, OPCIONAL (vacío = sin dato) y `no_consume`
 * excluyente con cualquier otra sustancia (mismo criterio que `ficha_registro_drogas_check`
 * y `agresor_drogas_check` en la base de datos).
 */
export type TipoDroga = Database['public']['Enums']['tipo_droga'];

/** Sustancias seleccionables (sin `no_consume`, que es una opción excluyente aparte). */
export const TIPOS_DROGA: readonly TipoDroga[] = [
  'marihuana',
  'cristal',
  'cocaina',
  'inhalantes',
  'medicamento_controlado',
  'otra',
];

/** Opciones del selector: «No consume» primero y luego las sustancias. */
export const OPCIONES_CONSUMO_DROGA: readonly TipoDroga[] = ['no_consume', ...TIPOS_DROGA];

export const DROGA_LABELS: Record<TipoDroga, string> = {
  no_consume: 'No consume',
  marihuana: 'Marihuana',
  cristal: 'Cristal',
  cocaina: 'Cocaína',
  inhalantes: 'Inhalantes',
  medicamento_controlado: 'Medicamento controlado',
  otra: 'Otra',
};

export const ESPECIFICACION_DROGA_MAX = 250;

const DROGA_SET = new Set<string>(OPCIONES_CONSUMO_DROGA);

export function isTipoDroga(value: string): value is TipoDroga {
  return DROGA_SET.has(value);
}

/**
 * Alterna una opción respetando la exclusividad de `no_consume`:
 * al activarlo se limpian las demás; al activar otra se quita `no_consume`.
 */
export function toggleDroga(actuales: readonly TipoDroga[], droga: TipoDroga): TipoDroga[] {
  if (actuales.includes(droga)) return actuales.filter((d) => d !== droga);
  if (droga === 'no_consume') return ['no_consume'];
  return [...actuales.filter((d) => d !== 'no_consume'), droga];
}

/** Cuándo mostrar el campo de especificación: solo con «Otra» seleccionada. */
export function requiereEspecificacionDroga(drogas: readonly TipoDroga[] | null | undefined): boolean {
  return Boolean(drogas?.includes('otra'));
}

export interface ConsumoDrogasNormalizado {
  /** `null` = sin dato (selección vacía). */
  drogas: TipoDroga[] | null;
  /** Solo con «Otra»; `null` en cualquier otro caso. */
  especificacionDroga: string | null;
}

/** Deduplica, descarta valores inválidos y deja la especificación solo si hay «Otra». */
export function normalizarConsumoDrogas(
  drogas: readonly string[] | null | undefined,
  especificacionDroga: string | null | undefined,
): ConsumoDrogasNormalizado {
  const validas = Array.from(new Set((drogas ?? []).filter(isTipoDroga)));
  const lista = validas.includes('no_consume') && validas.length > 1
    ? validas.filter((d) => d !== 'no_consume')
    : validas;
  const especificacion = especificacionDroga?.trim() ?? '';
  return {
    drogas: lista.length > 0 ? lista : null,
    especificacionDroga: lista.includes('otra') && especificacion ? especificacion : null,
  };
}

export type ConsumoDrogasErrores = Partial<Record<'drogas' | 'especificacionDroga', string>>;

/** El consumo NUNCA es obligatorio: una selección vacía es válida. */
export function validarConsumoDrogas(input: {
  drogas?: readonly string[] | null;
  especificacionDroga?: string | null;
}): ConsumoDrogasErrores {
  const errores: ConsumoDrogasErrores = {};
  const drogas = input.drogas ?? [];
  if (drogas.some((d) => !DROGA_SET.has(d))) {
    errores.drogas = 'Una o más opciones de droga no son válidas.';
  } else if (drogas.includes('no_consume') && drogas.length > 1) {
    errores.drogas = '«No consume» no se puede combinar con otras sustancias.';
  }
  if ((input.especificacionDroga?.length ?? 0) > ESPECIFICACION_DROGA_MAX) {
    errores.especificacionDroga = `La especificación de droga no puede exceder ${ESPECIFICACION_DROGA_MAX} caracteres.`;
  }
  return errores;
}

/** Texto para mostrar el consumo: «No consume», lista (con «Otra (detalle)») o `null` (sin dato). */
export function formatConsumoDrogas(
  drogas: readonly TipoDroga[] | null | undefined,
  especificacionDroga?: string | null,
): string | null {
  if (!drogas || drogas.length === 0) return null;
  return drogas
    .map((d) => (d === 'otra' && especificacionDroga ? `Otra (${especificacionDroga})` : DROGA_LABELS[d]))
    .join(', ');
}
