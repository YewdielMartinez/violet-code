import { describe, expect, it } from 'vitest';
import {
  mapActividadRow,
  mapParticipantes,
  toRegistrarPayload,
} from '@/infrastructure/supabase/adapters/actividadPreventiva.mapper';

// El RPC puede devolver nulos aunque los tipos generados los declaren como string/number.
const ROW = {
  id: 'act-1',
  titulo: 'Taller de prevención',
  tipo_actividad_id: 2,
  tipo_actividad_clave: 'taller',
  tipo_actividad_nombre: 'Taller',
  tipo_institucion: 'empresa_privada' as const,
  nivel_educativo: null,
  sede: 'Ingenio Central',
  direccion: null,
  referencias: null,
  asentamiento_id: null,
  asentamiento_nombre: null,
  codigo_postal: null,
  municipio: null,
  programada_en: '2026-12-02T16:00:00Z',
  numero_asistentes: null,
  creado_por: null,
  creado_por_nombre: null,
  creado_en: '2026-11-26T10:00:00Z',
  participantes: [],
};

describe('actividadPreventiva.mapper', () => {
  it('mapea una fila snake_case a camelCase y normaliza nulos', () => {
    expect(mapActividadRow(ROW as unknown as Parameters<typeof mapActividadRow>[0])).toEqual({
      id: 'act-1',
      titulo: 'Taller de prevención',
      tipoActividadId: 2,
      tipoActividadClave: 'taller',
      tipoActividadNombre: 'Taller',
      tipoInstitucion: 'empresa_privada',
      nivelEducativo: null,
      sede: 'Ingenio Central',
      direccion: null,
      referencias: null,
      asentamientoId: null,
      asentamientoNombre: null,
      codigoPostal: null,
      municipio: null,
      programadaEn: '2026-12-02T16:00:00Z',
      numeroAsistentes: null,
      creadoPor: null,
      creadoPorNombre: null,
      creadoEn: '2026-11-26T10:00:00Z',
      participantes: [],
    });
  });

  it('ignora participantes que no son objetos y mapea los válidos', () => {
    expect(mapParticipantes(null)).toEqual([]);
    expect(mapParticipantes('x')).toEqual([]);
    expect(
      mapParticipantes([{ empleado_id: 'e1', nombre: 'Laura', rol: 'psicologia' }, null, 'texto', [1]]),
    ).toEqual([{ empleadoId: 'e1', nombre: 'Laura', rol: 'psicologia' }]);
  });

  it('arma el payload del RPC recortando texto y con valores por omisión', () => {
    expect(
      toRegistrarPayload({
        titulo: '  Taller  ',
        tipoActividadId: 2,
        tipoInstitucion: 'comunidad',
        sede: ' Parque Sinaloa ',
        direccion: '   ',
        programadaEn: '2026-12-02T10:00:00-07:00',
      }),
    ).toEqual({
      titulo: 'Taller',
      tipo_actividad_id: 2,
      tipo_institucion: 'comunidad',
      nivel_educativo: null,
      sede: 'Parque Sinaloa',
      direccion: null,
      referencias: null,
      asentamiento_id: null,
      programada_en: '2026-12-02T10:00:00-07:00',
      numero_asistentes: null,
      participantes_ids: [],
    });
  });
});
