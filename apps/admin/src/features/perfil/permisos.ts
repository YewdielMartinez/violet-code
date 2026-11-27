/** Etiquetas legibles de las claves de `tiene_permiso()` y de sus grupos (prefijo antes del punto). */

const GRUPOS: Record<string, string> = {
  expediente: 'Expedientes',
  seguimiento: 'Seguimiento',
  agresor: 'Persona agresora',
  historial_clinico: 'Historial clínico',
  nota_psicologia: 'Notas de psicología',
  orden_proteccion: 'Órdenes de protección',
  agenda: 'Agenda',
  urgencias: 'Urgencias',
  derivacion: 'Canalizaciones',
  canalizacion: 'Canalizaciones',
  alerta: 'Alertas',
  actividad: 'Actividades preventivas',
  informe: 'Informes',
  catalogos: 'Catálogos',
  directorio: 'Directorio',
  cuentas: 'Cuentas de usuario',
  bitacora: 'Bitácora',
};

const PERMISOS: Record<string, string> = {
  'expediente.ver': 'Ver expedientes',
  'expediente.escribir': 'Crear y editar expedientes',
  'expediente.verificar_curp': 'Verificar CURP',
  'expediente.reabrir': 'Reabrir expedientes',
  'seguimiento.registrar': 'Registrar seguimientos',
  'seguimiento.corregir': 'Corregir seguimientos',
  'agresor.acceder': 'Consultar datos de la persona agresora',
  'historial_clinico.acceder': 'Ver historial clínico',
  'historial_clinico.escribir': 'Registrar historial clínico',
  'nota_psicologia.acceder': 'Notas privadas de Psicología',
  'orden_proteccion.escribir': 'Registrar órdenes de protección',
  'agenda.ver': 'Ver agenda',
  'agenda.gestionar': 'Gestionar citas',
  'agenda.crear': 'Crear citas',
  'urgencias.ver': 'Ver lista de urgencias',
  'derivacion.gestionar': 'Gestionar canalizaciones',
  'canalizacion.crear': 'Crear canalizaciones',
  'alerta.atender': 'Atender alertas',
  'alerta.ver_cola': 'Ver cola de alertas',
  'actividad.ver': 'Ver actividades',
  'actividad.registrar': 'Registrar actividades',
  'informe.ver': 'Ver informes',
  'catalogos.gestionar': 'Gestionar catálogos',
  'directorio.gestionar': 'Gestionar directorio',
  'cuentas.gestionar': 'Gestionar cuentas',
  'bitacora.ver': 'Consultar bitácora',
};

function humanize(text: string): string {
  const spaced = text.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function etiquetaPermiso(clave: string): string {
  return PERMISOS[clave] ?? humanize(clave.split('.').slice(1).join(' ') || clave);
}

export function etiquetaGrupo(prefijo: string): string {
  return GRUPOS[prefijo] ?? humanize(prefijo);
}

export interface GrupoPermisos {
  prefijo: string;
  titulo: string;
  permisos: { clave: string; etiqueta: string }[];
}

/** Agrupa las claves por prefijo, respetando el orden en que aparecen los grupos en `GRUPOS`. */
export function agruparPermisos(claves: readonly string[]): GrupoPermisos[] {
  const porPrefijo = new Map<string, GrupoPermisos>();
  for (const clave of claves) {
    const prefijo = clave.split('.')[0] ?? clave;
    const grupo = porPrefijo.get(prefijo) ?? { prefijo, titulo: etiquetaGrupo(prefijo), permisos: [] };
    grupo.permisos.push({ clave, etiqueta: etiquetaPermiso(clave) });
    porPrefijo.set(prefijo, grupo);
  }
  const orden = Object.keys(GRUPOS);
  const rank = (p: string) => {
    const i = orden.indexOf(p);
    return i === -1 ? orden.length : i;
  };
  return [...porPrefijo.values()].sort((a, b) => rank(a.prefijo) - rank(b.prefijo));
}
