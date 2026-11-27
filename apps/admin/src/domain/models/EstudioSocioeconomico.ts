import type { Database } from '@/infrastructure/supabase/database.types';

export type TipoVivienda = Database['public']['Enums']['tipo_vivienda'];
export type MaterialVivienda = Database['public']['Enums']['material_vivienda'];
export type TipoTrabajo = Database['public']['Enums']['tipo_trabajo'];
export type FrecuenciaIngreso = Database['public']['Enums']['frecuencia_ingreso'];
export type ServicioVivienda = Database['public']['Enums']['servicio_vivienda'];
export type BienVivienda = Database['public']['Enums']['bien_vivienda'];

export const TIPO_VIVIENDA_LABELS: Record<TipoVivienda, string> = {
  propia: 'Propia',
  hipotecada: 'Hipotecada',
  rentada: 'Rentada',
  invasion: 'Invasión',
  infonavit: 'Infonavit',
  prestada: 'Prestada',
};

export const MATERIAL_VIVIENDA_LABELS: Record<MaterialVivienda, string> = {
  ladrillo: 'Ladrillo',
  block: 'Block',
  lamina: 'Lámina',
  madera: 'Madera',
  carton: 'Cartón',
  otro: 'Otro',
};

export const TIPO_TRABAJO_LABELS: Record<TipoTrabajo, string> = {
  fijo: 'Fijo',
  temporal: 'Temporal',
  negocio_propio: 'Negocio propio',
};

export const FRECUENCIA_INGRESO_LABELS: Record<FrecuenciaIngreso, string> = {
  diario: 'Diario',
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
  variable: 'Variable',
};

export const SERVICIOS_VIVIENDA: readonly { value: ServicioVivienda; label: string }[] = [
  { value: 'agua', label: 'Agua potable' },
  { value: 'drenaje', label: 'Drenaje' },
  { value: 'luz', label: 'Energía eléctrica (luz)' },
  { value: 'pavimento', label: 'Pavimento' },
  { value: 'cable', label: 'TV por cable' },
  { value: 'internet', label: 'Internet' },
];

export const BIENES_VIVIENDA: readonly { value: BienVivienda; label: string }[] = [
  { value: 'estufa', label: 'Estufa' },
  { value: 'refrigerador', label: 'Refrigerador' },
  { value: 'lavadora', label: 'Lavadora' },
  { value: 'aire_acondicionado', label: 'Aire acondicionado' },
  { value: 'abanico', label: 'Abanico' },
  { value: 'tv', label: 'Televisión' },
  { value: 'microondas', label: 'Microondas' },
  { value: 'computadora', label: 'Computadora' },
];

export interface AportanteHogarInput {
  nombre: string;
  parentescoId: number | null;
  parentescoOtro: string;
  ocupacionId: number | null;
  ocupacionOtra: string;
  tipoTrabajo: TipoTrabajo | '';
  monto: string;
  frecuencia: FrecuenciaIngreso | '';
}

export interface EstudioSocioeconomicoInput {
  ingresoMensualPropio: string;
  numeroDependientes: string;
  tieneApoyo: boolean;
  especificacionApoyo: string;
  tipoVivienda: TipoVivienda | '';
  material: MaterialVivienda | '';
  materialOtro: string;
  servicios: string[];
  bienes: string[];
  aportantes: AportanteHogarInput[];
}

export interface AportanteRegistroInput {
  nombre?: string | null;
  parentescoId?: number | null;
  parentescoOtro?: string | null;
  ocupacionId?: number | null;
  ocupacionOtra?: string | null;
  tipoTrabajo?: TipoTrabajo | null;
  monto?: number | null;
  frecuencia?: FrecuenciaIngreso | null;
}

export interface EstudioSocioeconomicoRegistroInput {
  fichaId: string;
  ingresoMensualPropio?: number | null;
  numeroDependientes?: number | null;
  tieneApoyo?: boolean;
  especificacionApoyo?: string | null;
  tipoVivienda?: TipoVivienda | null;
  material?: MaterialVivienda | null;
  materialOtro?: string | null;
  servicios?: ServicioVivienda[] | null;
  bienes?: BienVivienda[] | null;
  aportantes?: AportanteRegistroInput[];
}

export interface EstudioSocioeconomicoRegistradoResult {
  estudioId: string;
  fichaId: string;
  fechaEstudio: string;
  esActual: boolean;
  fueCorreccion: boolean;
  actualizadoEn: string;
}

export interface EstudioSocioeconomicoDetalle {
  id: string;
  fechaEstudio: string;
  ingresoMensualPropio: number | null;
  numeroDependientes: number | null;
  tieneApoyo: boolean;
  especificacionApoyo: string | null;
  tipoVivienda: TipoVivienda | null;
  material: MaterialVivienda | null;
  materialOtro: string | null;
  servicios: string[];
  bienes: string[];
  actualizadoEn?: string | null;
  aportantes: {
    id: string;
    nombre: string;
    parentescoId?: number | null;
    parentescoNombre: string | null;
    parentescoOtro?: string | null;
    ocupacionId?: number | null;
    ocupacionNombre: string | null;
    ocupacionOtra?: string | null;
    tipoTrabajo: TipoTrabajo | null;
    monto: number | null;
    frecuencia: FrecuenciaIngreso | null;
  }[];
}

export const EMPTY_APORTANTE: AportanteHogarInput = {
  nombre: '',
  parentescoId: null,
  parentescoOtro: '',
  ocupacionId: null,
  ocupacionOtra: '',
  tipoTrabajo: '',
  monto: '',
  frecuencia: '',
};

export const INITIAL_ESTUDIO_INPUT: EstudioSocioeconomicoInput = {
  ingresoMensualPropio: '',
  numeroDependientes: '0',
  tieneApoyo: false,
  especificacionApoyo: '',
  tipoVivienda: '',
  material: '',
  materialOtro: '',
  servicios: [],
  bienes: [],
  aportantes: [],
};

export function validateEstudioSocioeconomico(input: EstudioSocioeconomicoInput): string | null {
  if (input.ingresoMensualPropio.trim()) {
    const ingreso = Number(input.ingresoMensualPropio);
    if (!Number.isFinite(ingreso) || ingreso < 0 || ingreso > 9_999_999.99) {
      return 'El ingreso mensual propio debe estar entre 0 y 9,999,999.99.';
    }
  }
  if (input.numeroDependientes.trim()) {
    const dep = Number(input.numeroDependientes);
    if (!Number.isInteger(dep) || dep < 0 || dep > 30) {
      return 'El número de dependientes debe ser un entero entre 0 y 30.';
    }
  }
  if (input.tieneApoyo && !input.especificacionApoyo.trim()) {
    return 'Especifica qué tipo de apoyo gubernamental o familiar recibe.';
  }
  if (input.material === 'otro' && !input.materialOtro.trim()) {
    return 'Especifica el material de la vivienda cuando selecciones «Otro».';
  }
  for (let i = 0; i < input.aportantes.length; i++) {
    const ap = input.aportantes[i];
    if (!ap.nombre.trim()) {
      return `Captura el nombre del aportante #${i + 1} o elimínalo de la lista.`;
    }
    if (ap.monto.trim()) {
      const m = Number(ap.monto);
      if (!Number.isFinite(m) || m < 0 || m > 9_999_999.99) {
        return `El monto del aportante #${i + 1} debe ser válido (>= 0).`;
      }
    }
  }
  return null;
}
