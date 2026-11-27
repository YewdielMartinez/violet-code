import type { StaffRole } from './Auth';

export interface HistorialClinico {
  id: string;
  fichaId: string;
  motivoConsulta: string | null;
  antecedentesPersonales: string | null;
  antecedentesFamiliares: string | null;
  tieneAtencionPsicologicaPrevia: boolean | null;
  observacionesIniciales: string | null;
  creadoEn: string | null;
  actualizadoEn: string;
}

export interface HistorialClinicoGuardarInput {
  fichaId: string;
  /** Obligatorio al editar (`get_historial_clinico` previo); omitir o `null` al crear. */
  actualizadoEn?: string | null;
  motivoConsulta?: string | null;
  antecedentesPersonales?: string | null;
  antecedentesFamiliares?: string | null;
  tieneAtencionPsicologicaPrevia?: boolean | null;
  observacionesIniciales?: string | null;
}

/** Campos del historial clínico que se versionan (en el mismo orden en que se muestran). */
export const HISTORIAL_CLINICO_CAMPOS = [
  'motivoConsulta',
  'antecedentesPersonales',
  'antecedentesFamiliares',
  'tieneAtencionPsicologicaPrevia',
  'observacionesIniciales',
] as const;

export type HistorialClinicoCampo = (typeof HISTORIAL_CLINICO_CAMPOS)[number];

export const HISTORIAL_CLINICO_CAMPO_LABEL: Record<HistorialClinicoCampo, string> = {
  motivoConsulta: 'Motivo de consulta',
  antecedentesPersonales: 'Antecedentes personales',
  antecedentesFamiliares: 'Antecedentes familiares',
  tieneAtencionPsicologicaPrevia: 'Atención psicológica previa',
  observacionesIniciales: 'Observaciones iniciales',
};

/** Snapshot del historial tras un guardado (`get_historial_clinico_versiones`, migración 67). */
export interface HistorialClinicoVersion {
  id: string;
  historialClinicoId: string;
  fichaId: string;
  /** 1 = registro inicial; sube con cada guardado que cambia algún dato. */
  version: number;
  motivoConsulta: string | null;
  antecedentesPersonales: string | null;
  antecedentesFamiliares: string | null;
  tieneAtencionPsicologicaPrevia: boolean | null;
  observacionesIniciales: string | null;
  camposModificados: HistorialClinicoCampo[];
  creadoPor: string | null;
  creadoPorNombre: string | null;
  creadoEn: string;
}

export interface HistorialClinicoCambio {
  campo: HistorialClinicoCampo;
  label: string;
  /** Valor en la versión anterior (`null` si no había o es el registro inicial). */
  antes: string | null;
  /** Valor tras este guardado (`null` si se dejó vacío). */
  despues: string | null;
}

/** Solo Psicología crea o edita el historial clínico (`historial_clinico.escribir`); Dirección solo lo lee. */
export function puedeEscribirHistorialClinico(role: StaffRole | undefined): boolean {
  return role === 'psicologia';
}

/** Contenido clínico del historial (lo que se captura y se versiona). */
export type HistorialClinicoContenido = Pick<HistorialClinico, HistorialClinicoCampo>;

/** Texto mostrable de un campo del historial (booleano a «Sí»/«No»; vacío a `null`). */
export function valorCampoHistorial(
  source: HistorialClinicoContenido,
  campo: HistorialClinicoCampo,
): string | null {
  const value = source[campo];
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  const clean = value?.trim();
  return clean ? clean : null;
}

/**
 * Qué cambió en `version` respecto de `anterior` (la versión inmediata previa; `null` en la 1).
 * Usa `camposModificados` que registra el servidor para el orden y el conjunto de campos.
 */
export function calcularCambiosVersion(
  version: HistorialClinicoVersion,
  anterior: HistorialClinicoVersion | null,
): HistorialClinicoCambio[] {
  const modificados = new Set<HistorialClinicoCampo>(version.camposModificados);
  return HISTORIAL_CLINICO_CAMPOS.filter((campo) => modificados.has(campo)).map((campo) => ({
    campo,
    label: HISTORIAL_CLINICO_CAMPO_LABEL[campo],
    antes: anterior ? valorCampoHistorial(anterior, campo) : null,
    despues: valorCampoHistorial(version, campo),
  }));
}

function normalizarCampo(source: HistorialClinicoContenido | null | undefined, campo: HistorialClinicoCampo): string {
  const value = source?.[campo];
  // Para el servidor, «sin dato» y «No» de atención previa son lo mismo al editar.
  if (campo === 'tieneAtencionPsicologicaPrevia') return value ? 'true' : 'false';
  return typeof value === 'string' ? value.trim() : '';
}

/** Campos cuyo valor difiere entre dos contenidos (`antes` `null` = aún no hay historial). */
export function camposCambiados(
  antes: HistorialClinicoContenido | null | undefined,
  despues: HistorialClinicoContenido,
): HistorialClinicoCampo[] {
  return HISTORIAL_CLINICO_CAMPOS.filter(
    (campo) => normalizarCampo(antes, campo) !== normalizarCampo(despues, campo),
  );
}
