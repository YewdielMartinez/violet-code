import { isSupervisor, type StaffRole } from './Auth';

export const LIMITE_TEXTO_CLINICO = 5000;

export interface PrimeraSesionInput {
  antecedentesFamiliares: string;
  antecedentesPersonales: string;
  motivoConsulta: string;
  observacionesIniciales: string;
  tieneAtencionPsicologicaPrevia: boolean | null;
}

export interface HistorialClinico extends PrimeraSesionInput {
  id: string;
  activo: boolean;
  creadoEn: string;
}

export interface AtencionClinica {
  id: string;
  citaId: string | null;
  atendidaEn: string;
  observaciones: string | null;
  tipoAtencionId: number;
  activo: boolean;
}

export interface CitaClinica {
  id: string;
  programadaEn: string;
}

export interface ExpedienteClinico {
  folio: string;
  puedeRegistrarAtencion: boolean;
  historial: HistorialClinico | null;
  atenciones: AtencionClinica[];
  citas: CitaClinica[];
  tiposAtencion: { id: number; nombre: string }[];
}

export type VisitaClinica =
  | { tipo: 'existente'; atencionId: string }
  | { tipo: 'nueva'; id: string; citaId: string | null; tipoAtencionId: number };

export type RegistroClinicoInput =
  | { tipo: 'primera'; datos: PrimeraSesionInput }
  | { tipo: 'seguimiento'; visita: VisitaClinica; observacion: string };

export const puedeAccederHistorialClinico = (rol: StaffRole | undefined): boolean =>
  rol === 'psicologia' || isSupervisor(rol);

export function citasSinAtencion({ citas, atenciones }: ExpedienteClinico): CitaClinica[] {
  const citasOcupadas = new Set(atenciones.map((atencion) => atencion.citaId));
  return citas.filter((cita) => !citasOcupadas.has(cita.id));
}

const FECHA_AHOME = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mazatlan' });

export function esMayorDeEdadClinica(fechaNacimiento: string, ahora = new Date()): boolean {
  const [anio, mes, dia] = FECHA_AHOME.format(ahora).split('-').map(Number);
  const anioLimite = anio - 18;
  const ultimoDia = new Date(Date.UTC(anioLimite, mes, 0)).getUTCDate();
  const limite = [anioLimite, mes, Math.min(dia, ultimoDia)].map((parte) =>
    String(parte).padStart(2, '0')).join('-');
  return fechaNacimiento <= limite;
}

function excedeLimite(texto: string): boolean {
  return Array.from(texto.trim()).length > LIMITE_TEXTO_CLINICO;
}

export function validarRegistroClinico(
  expediente: ExpedienteClinico,
  input: RegistroClinicoInput,
): string | null {
  const { historial } = expediente;
  if (!expediente.puedeRegistrarAtencion) {
    return 'Psicología solo puede registrar atenciones para personas de 18 años o más.';
  }
  if (input.tipo === 'primera') {
    if (historial) return 'Ya existe un historial clínico para este expediente.';
    const { motivoConsulta, antecedentesFamiliares, antecedentesPersonales, observacionesIniciales } =
      input.datos;
    if (!motivoConsulta.trim()) return 'Escribe el motivo de consulta.';
    if ([motivoConsulta, antecedentesFamiliares, antecedentesPersonales, observacionesIniciales].some(excedeLimite)) {
      return 'Cada texto clínico admite hasta 5,000 caracteres.';
    }
    return null;
  }

  if (!historial?.activo) return 'Se necesita un historial clínico activo para registrar seguimientos.';
  if (!input.observacion.trim()) return 'Escribe la observación de esta sesión.';
  if (excedeLimite(input.observacion)) return 'La observación admite hasta 5,000 caracteres.';

  const { visita } = input;
  if (visita.tipo === 'existente') {
    if (!expediente.atenciones.some((a) => a.id === visita.atencionId && a.activo && a.observaciones === null)) {
      return 'Esta atención ya tiene una observación o no está disponible. Elige otra visita.';
    }
  } else {
    if (visita.citaId && !citasSinAtencion(expediente).some((cita) => cita.id === visita.citaId)) {
      return 'Esta cita ya tiene una atención o no está disponible. Elige otra visita.';
    }
    if (!expediente.tiposAtencion.some((tipo) => tipo.id === visita.tipoAtencionId)) {
      return 'Selecciona el tipo de atención.';
    }
  }
  return null;
}
