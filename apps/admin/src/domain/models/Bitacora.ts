/**
 * Bitácora de accesos (`RF-22`, `RF-22.1`): quién vio o cambió qué y cuándo. Solo lectura y exclusiva de Dirección
 * (`bitacora.ver`: titular y subdirección). La tabla solo guarda actor, acción, tabla y el id del registro: nunca
 * contenido de notas ni datos personales de las usuarias.
 */
import { isSupervisor, type StaffRole } from './Auth';

export type AccionBitacora = 'ver' | 'crear' | 'actualizar' | 'desactivar';
export type ActorTipoBitacora = 'empleado' | 'usuario_externo' | 'sistema';

export const ACCIONES_BITACORA: readonly AccionBitacora[] = ['ver', 'crear', 'actualizar', 'desactivar'];

export const ACCION_BITACORA_LABELS: Record<AccionBitacora, string> = {
  ver: 'Consulta',
  crear: 'Alta',
  actualizar: 'Modificación',
  desactivar: 'Baja',
};

/** Nombres legibles de las tablas auditadas; las que no estén aquí se muestran con su nombre técnico formateado. */
export const TABLA_BITACORA_LABELS: Readonly<Record<string, string>> = {
  actividad_preventiva: 'Actividades preventivas',
  agresor: 'Personas agresoras',
  alerta: 'Alertas',
  aportante_hogar: 'Aportantes del hogar',
  atencion: 'Atenciones',
  cita: 'Citas',
  cola: 'Cola de alertas',
  derivacion: 'Canalizaciones',
  documento: 'Documentos',
  domicilio: 'Domicilios',
  empleado: 'Personal',
  estudio_socioeconomico: 'Estudios socioeconómicos',
  ficha_registro: 'Fichas de registro',
  ficha_servicio_solicitado: 'Servicios solicitados',
  historial_clinico: 'Historiales clínicos',
  nota_area: 'Notas de área',
  orden_proteccion: 'Órdenes de protección',
  persona: 'Personas',
  pre_registro: 'Pre-registros',
  usuario_externo: 'Usuarios externos',
};

export function tablaBitacoraLabel(tabla: string): string {
  const known = TABLA_BITACORA_LABELS[tabla];
  if (known) return known;
  const text = tabla.replace(/_/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : tabla;
}

export function accionBitacoraLabel(accion: string): string {
  return ACCION_BITACORA_LABELS[accion as AccionBitacora] ?? accion;
}

export interface BitacoraEvento {
  id: string;
  /** ISO 8601 con zona. */
  creadoEn: string;
  actorTipo: ActorTipoBitacora;
  actorNombre: string;
  /** Rol del personal o dependencia de la cuenta externa; `null` si no hubo actor (sistema / app). */
  actorRol: string | null;
  tabla: string;
  accion: AccionBitacora;
  registroId: string | null;
}

export interface BitacoraFiltros {
  /** `null` = todas las tablas. */
  tabla: string | null;
  /** `null` = todas las acciones. */
  accion: AccionBitacora | null;
  /** Instante ISO inclusive, o `null`. */
  desde: string | null;
  hasta: string | null;
}

export interface BitacoraPaginaInput extends BitacoraFiltros {
  limite: number;
  offset: number;
}

export interface BitacoraPagina {
  eventos: BitacoraEvento[];
  /** Eventos que cumplen los filtros (todas las páginas). */
  total: number;
}

export interface BitacoraOpcionesFiltro {
  tablas: string[];
  acciones: AccionBitacora[];
}

/** `bitacora.ver` = `es_direccion()`: titular y subdirección. */
export function puedeVerBitacora(role: StaffRole | undefined | null): boolean {
  return isSupervisor(role ?? undefined);
}
