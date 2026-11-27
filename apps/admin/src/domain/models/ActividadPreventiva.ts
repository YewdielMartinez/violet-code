import type { Database } from '@/infrastructure/supabase/database.types';
import { isAttentionRole, isSupervisor, type StaffRole } from './Auth';

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
  /** Estado explícito (`estado_actividad`): ya no se infiere de la fecha. */
  estado: EstadoActividad;
  /** Momento en que se marcó como realizada (`null` si no lo está). */
  realizadaEn: string | null;
  canceladaMotivo: string | null;
  observacionesCierre: string | null;
}

export interface ActividadPreventivaFilters {
  desde?: string | null;
  hasta?: string | null;
  /** Filtro del servidor (`p_estado`); sin valor trae todos los estados. */
  estado?: EstadoActividad | null;
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

export interface TipoActividadItem {
  id: number;
  clave: string;
  nombre: string;
}

/** Empleado activo que puede asignarse como participante de una actividad. */
export interface EmpleadoParticipanteOpcion {
  id: string;
  nombre: string;
  rol: RolEmpleado;
}

/**
 * Estado explícito de la actividad (enum `estado_actividad`). Transiciones y validaciones en `ActividadEstado.ts`.
 * TODO: alias de `Database['public']['Enums']['estado_actividad']` al regenerar `database.types.ts`.
 */
export type EstadoActividad = 'pendiente' | 'realizada' | 'cancelada';

export const ESTADOS_ACTIVIDAD: readonly EstadoActividad[] = ['pendiente', 'realizada', 'cancelada'];

export const ESTADO_ACTIVIDAD_LABELS: Record<EstadoActividad, string> = {
  pendiente: 'Pendiente',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
};

export function esEstadoActividad(value: unknown): value is EstadoActividad {
  return typeof value === 'string' && (ESTADOS_ACTIVIDAD as readonly string[]).includes(value);
}

export interface ActividadRegistradaResult {
  actividadId: string;
  totalParticipantes: number;
}

export type ActividadCampo =
  | 'titulo'
  | 'tipoActividadId'
  | 'tipoInstitucion'
  | 'nivelEducativo'
  | 'sede'
  | 'direccion'
  | 'referencias'
  | 'programadaEn'
  | 'numeroAsistentes';

export type ActividadErrores = Partial<Record<ActividadCampo, string>>;

/** Valida el alta campo por campo (espejo de las reglas de `registrar_actividad_preventiva`, `RF-16`). */
export function validateActividadCampos(input: ActividadPreventivaCreateInput): ActividadErrores {
  const errores: ActividadErrores = {};
  const titulo = input.titulo.trim();
  if (!titulo || titulo.length > 200) {
    errores.titulo = 'El título de la actividad debe tener entre 1 y 200 caracteres.';
  }
  if (!Number.isInteger(input.tipoActividadId) || input.tipoActividadId <= 0) {
    errores.tipoActividadId = 'Selecciona el tipo de actividad preventiva.';
  }
  if (!input.tipoInstitucion || !(input.tipoInstitucion in TIPO_INSTITUCION_LABELS)) {
    errores.tipoInstitucion = 'Selecciona el tipo de institución.';
  }
  if (input.nivelEducativo && input.tipoInstitucion !== 'escuela') {
    errores.nivelEducativo = 'El nivel educativo solo aplica cuando la actividad se realiza en una escuela.';
  }
  const sede = input.sede.trim();
  if (!sede || sede.length > 200) {
    errores.sede = 'La sede de la actividad debe tener entre 1 y 200 caracteres.';
  }
  if ((input.direccion?.trim().length ?? 0) > 250) {
    errores.direccion = 'La dirección no puede exceder 250 caracteres.';
  }
  if ((input.referencias?.trim().length ?? 0) > 250) {
    errores.referencias = 'Las referencias no pueden exceder 250 caracteres.';
  }
  if (!input.programadaEn.trim() || Number.isNaN(Date.parse(input.programadaEn))) {
    errores.programadaEn = 'Indica una fecha y hora válidas para la actividad.';
  }
  if (
    input.numeroAsistentes !== undefined &&
    input.numeroAsistentes !== null &&
    (!Number.isInteger(input.numeroAsistentes) || input.numeroAsistentes < 0 || input.numeroAsistentes > 10000)
  ) {
    errores.numeroAsistentes = 'El número de asistentes debe ser un entero entre 0 y 10000.';
  }
  return errores;
}

/** Valida los campos obligatorios antes de invocar `registrar_actividad_preventiva` (`RF-16`): primer error o `null`. */
export function validateActividadPreventiva(input: ActividadPreventivaCreateInput): string | null {
  return Object.values(validateActividadCampos(input))[0] ?? null;
}

/** Espejo de `actividad.registrar` (`tiene_permiso`): dirección o áreas de atención. `actividad.ver` es todo el personal activo. */
export function puedeRegistrarActividad(role: StaffRole | undefined): boolean {
  return isSupervisor(role) || isAttentionRole(role);
}
