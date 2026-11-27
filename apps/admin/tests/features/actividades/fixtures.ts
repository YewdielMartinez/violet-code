import type { ActividadPreventivaItem } from '@/domain/models/ActividadPreventiva';

export function act(id: string, programadaEn: string, extra: Partial<ActividadPreventivaItem> = {}): ActividadPreventivaItem {
  return {
    id,
    titulo: `Actividad ${id}`,
    tipoActividadId: 1,
    tipoActividadClave: 'taller',
    tipoActividadNombre: 'Taller',
    tipoInstitucion: 'escuela',
    nivelEducativo: null,
    sede: `Sede ${id}`,
    direccion: null,
    referencias: null,
    asentamientoId: null,
    asentamientoNombre: null,
    codigoPostal: null,
    municipio: null,
    programadaEn,
    numeroAsistentes: null,
    creadoPor: null,
    creadoPorNombre: null,
    creadoEn: '2026-11-20T00:00:00Z',
    participantes: [],
    ...extra,
  };
}
