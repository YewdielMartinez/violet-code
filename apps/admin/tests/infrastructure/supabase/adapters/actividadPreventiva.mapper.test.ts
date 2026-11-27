import { describe, expect, it } from 'vitest';
import {
  mapActividadRow,
  mapParticipantes,
  toActualizarActividadArgs,
  toActualizarEstadoArgs,
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
  estado: 'pendiente' as const,
  realizada_en: null,
  cancelada_motivo: null,
  observaciones_cierre: null,
  actualizado_en: '2026-11-26T11:00:00.123456+00:00',
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
      estado: 'pendiente',
      realizadaEn: null,
      canceladaMotivo: null,
      observacionesCierre: null,
      actualizadoEn: '2026-11-26T11:00:00.123456+00:00',
    });
  });

  it('si el servidor aún no manda actualizado_en queda en null', () => {
    const sin = { ...ROW } as Record<string, unknown>;
    delete sin.actualizado_en;
    expect(mapActividadRow(sin as unknown as Parameters<typeof mapActividadRow>[0]).actualizadoEn).toBeNull();
  });

  it('arma los argumentos de actualizar_actividad_preventiva: mismo payload que el alta + bloqueo optimista', () => {
    expect(
      toActualizarActividadArgs({
        actividadId: 'a1',
        actualizadoEn: '2026-11-26T11:00:00.123456+00:00',
        titulo: '  Taller  ',
        tipoActividadId: 2,
        tipoInstitucion: 'escuela',
        nivelEducativo: 'primaria',
        sede: ' Sede ',
        direccion: '   ',
        asentamientoId: 5,
        programadaEn: '2026-12-10T10:00:00-07:00',
        numeroAsistentes: 0,
        participantesIds: ['e1'],
      }),
    ).toEqual({
      p_actividad_id: 'a1',
      p_actualizado_en: '2026-11-26T11:00:00.123456+00:00',
      p_payload: {
        titulo: 'Taller',
        tipo_actividad_id: 2,
        tipo_institucion: 'escuela',
        nivel_educativo: 'primaria',
        sede: 'Sede',
        direccion: null,
        referencias: null,
        asentamiento_id: 5,
        programada_en: '2026-12-10T10:00:00-07:00',
        numero_asistentes: 0,
        participantes_ids: ['e1'],
      },
    });
  });

  it('mapea el estado explícito y sus datos de cierre', () => {
    const realizada = mapActividadRow({
      ...ROW,
      estado: 'realizada',
      realizada_en: '2026-12-02T18:00:00Z',
      observaciones_cierre: 'Buen cierre',
      numero_asistentes: 60,
    } as unknown as Parameters<typeof mapActividadRow>[0]);
    expect(realizada).toMatchObject({
      estado: 'realizada',
      realizadaEn: '2026-12-02T18:00:00Z',
      observacionesCierre: 'Buen cierre',
      numeroAsistentes: 60,
    });

    const cancelada = mapActividadRow({
      ...ROW,
      estado: 'cancelada',
      cancelada_motivo: 'Lluvia',
    } as unknown as Parameters<typeof mapActividadRow>[0]);
    expect(cancelada).toMatchObject({ estado: 'cancelada', canceladaMotivo: 'Lluvia', realizadaEn: null });
  });

  it('si el servidor aún no manda estado (o manda uno desconocido) cae en pendiente', () => {
    const sinEstado = { ...ROW } as Record<string, unknown>;
    delete sinEstado.estado;
    expect(mapActividadRow(sinEstado as unknown as Parameters<typeof mapActividadRow>[0]).estado).toBe('pendiente');
    expect(
      mapActividadRow({ ...ROW, estado: 'otro' } as unknown as Parameters<typeof mapActividadRow>[0]).estado,
    ).toBe('pendiente');
  });

  it('arma los argumentos de actualizar_estado_actividad recortando texto y con null por omisión', () => {
    expect(
      toActualizarEstadoArgs({
        actividadId: 'a1',
        estado: 'realizada',
        numeroAsistentes: 0,
        observaciones: '  Todo bien ',
      }),
    ).toEqual({
      p_actividad_id: 'a1',
      p_estado: 'realizada',
      p_numero_asistentes: 0,
      p_observaciones: 'Todo bien',
      p_motivo_cancelacion: null,
    });
    expect(toActualizarEstadoArgs({ actividadId: 'a1', estado: 'cancelada', motivoCancelacion: '   ' })).toEqual({
      p_actividad_id: 'a1',
      p_estado: 'cancelada',
      p_numero_asistentes: null,
      p_observaciones: null,
      p_motivo_cancelacion: null,
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
