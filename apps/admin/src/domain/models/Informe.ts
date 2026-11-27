import type { Database } from '@/infrastructure/supabase/database.types';

export type AccionBitacora = Database['public']['Enums']['accion_bitacora'];
export type ActorTipoBitacora = 'empleado' | 'usuario_externo' | 'sistema';

export interface InformeFilters {
  anio: number;
  mes?: number | null;
  areaId?: number | null;
}

export interface InformeRow {
  anio: number;
  mes: number | null;
  areaId: number;
  area: string;
  tipoAtencion: string;
  primeraVezOSeguimiento: 'primera_vez' | 'seguimiento';
  mujeres: number;
  hombres: number;
  totalPersonas: number;
  totalAtenciones: number;
}

export interface BitacoraFilters {
  desde?: string | null;
  hasta?: string | null;
  tabla?: string | null;
  empleadoId?: string | null;
  limite?: number;
}

export interface BitacoraRow {
  id: string;
  accion: AccionBitacora;
  tablaAfectada: string;
  registroId: string | null;
  empleadoId: string | null;
  usuarioExternoId: string | null;
  actorTipo: ActorTipoBitacora;
  actorNombre: string;
  actorRol: string | null;
  creadoEn: string;
}
