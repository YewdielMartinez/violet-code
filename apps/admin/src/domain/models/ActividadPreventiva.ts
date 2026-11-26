import type { Database } from '@/infrastructure/supabase/database.types';

export type TipoInstitucionActividad = Database['public']['Enums']['tipo_institucion_actividad'];
export type NivelEducativo = Database['public']['Enums']['nivel_educativo'];
export type RolEmpleado = Database['public']['Enums']['rol_empleado'];

export const TIPO_INSTITUCION_LABELS: Record<TipoInstitucionActividad, string> = {
  escuela: 'Escuela',
  empresa_privada: 'Empresa privada',
  sector_publico: 'Sector público',
  comunidad: 'Comunidad',
  otro: 'Otro',
};

export const NIVEL_EDUCATIVO_LABELS: Record<NivelEducativo, string> = {
  primaria: 'Primaria',
  secundaria: 'Secundaria',
  preparatoria: 'Preparatoria',
  universidad: 'Universidad',
};

export interface ActividadParticipante {
  empleadoId: string;
  nombre: string;
  rol: RolEmpleado;
}

export interface ActividadPreventivaItem {
  id: string;
  titulo: string;
  tipoActividadId: number;
  tipoActividadClave: string;
  tipoActividadNombre: string;
  tipoInstitucion: TipoInstitucionActividad;
  nivelEducativo: NivelEducativo | null;
  sede: string;
  direccion: string | null;
  referencias: string | null;
  asentamientoId: number | null;
  asentamientoNombre: string | null;
  codigoPostal: string | null;
  municipio: string | null;
  programadaEn: string;
  numeroAsistentes: number | null;
  creadoPor: string | null;
  creadoPorNombre: string | null;
  creadoEn: string;
  participantes: ActividadParticipante[];
}

export interface ActividadPreventivaFilters {
  desde?: string | null;
  hasta?: string | null;
  limite?: number;
}

export interface ActividadPreventivaCreateInput {
  titulo: string;
  tipoActividadId: number;
  tipoInstitucion: TipoInstitucionActividad;
  nivelEducativo?: NivelEducativo | null;
  sede: string;
  direccion?: string | null;
  referencias?: string | null;
  asentamientoId?: number | null;
  programadaEn: string;
  numeroAsistentes?: number | null;
  participantesIds?: string[];
}

export interface ActividadRegistradaResult {
  actividadId: string;
  totalParticipantes: number;
}

/** Valida los campos obligatorios antes de invocar `registrar_actividad_preventiva` (`RF-16`). */
export function validateActividadPreventiva(input: ActividadPreventivaCreateInput): string | null {
  const titulo = input.titulo.trim();
  if (!titulo || titulo.length > 200) {
    return 'El título de la actividad debe tener entre 1 y 200 caracteres.';
  }
  if (!Number.isInteger(input.tipoActividadId) || input.tipoActividadId <= 0) {
    return 'Selecciona el tipo de actividad preventiva.';
  }
  if (input.nivelEducativo && input.tipoInstitucion !== 'escuela') {
    return 'El nivel educativo solo aplica cuando la actividad se realiza en una escuela.';
  }
  const sede = input.sede.trim();
  if (!sede || sede.length > 200) {
    return 'La sede de la actividad debe tener entre 1 y 200 caracteres.';
  }
  if (!input.programadaEn.trim() || Number.isNaN(Date.parse(input.programadaEn))) {
    return 'Indica una fecha y hora válidas para la actividad.';
  }
  if (
    input.numeroAsistentes !== undefined &&
    input.numeroAsistentes !== null &&
    (!Number.isInteger(input.numeroAsistentes) ||
      input.numeroAsistentes < 0 ||
      input.numeroAsistentes > 10000)
  ) {
    return 'El número de asistentes debe ser un entero entre 0 y 10000.';
  }
  return null;
}
