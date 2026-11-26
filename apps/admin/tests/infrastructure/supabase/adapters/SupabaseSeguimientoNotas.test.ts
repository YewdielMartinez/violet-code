import { beforeEach, describe, expect, it, vi } from 'vitest';

type Result = { data: unknown; error: unknown };

const { rpcMock, fromMock, getSessionMock, calls, results } = vi.hoisted(() => {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const results: Record<string, Result> = {};
  return {
    calls,
    results,
    rpcMock: vi.fn(),
    getSessionMock: vi.fn(),
    fromMock: vi.fn((table: string) => {
      const result = () => results[table] ?? { data: null, error: null };
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'insert', 'update', 'eq', 'order']) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return builder;
        };
      }
      builder.single = () => Promise.resolve(result());
      builder.maybeSingle = () => Promise.resolve(result());
      builder.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(result()).then(resolve, reject);
      return builder;
    }),
  };
});

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: { rpc: rpcMock, from: fromMock, auth: { getSession: getSessionMock } },
}));

import { supabaseSeguimientoRepository } from '@/infrastructure/supabase/adapters/SupabaseSeguimientoRepository';

const NOTA_ROW = {
  id: 'n-1',
  ficha_id: 'f-1',
  area_id: 2,
  contenido: 'Nota del área',
  activo: true,
  creado_en: '2026-11-26T10:00:00Z',
  actualizado_en: '2026-11-26T10:00:00Z',
  creado_por: 'emp-1',
};

function callsOf(table: string, method: string) {
  return calls.filter((c) => c.table === table && c.method === method).map((c) => c.args);
}

describe('supabaseSeguimientoRepository · notas privadas y copia de la hoja', () => {
  beforeEach(() => {
    calls.length = 0;
    for (const key of Object.keys(results)) delete results[key];
    rpcMock.mockReset();
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: 'emp-1' } } } });
  });

  it('lista solo notas activas de la ficha y mapea camelCase', async () => {
    results.nota_area = { data: [NOTA_ROW], error: null };
    const notas = await supabaseSeguimientoRepository.listarNotas('f-1');
    expect(callsOf('nota_area', 'eq')).toEqual([
      ['ficha_id', 'f-1'],
      ['activo', true],
    ]);
    expect(notas).toEqual([
      {
        id: 'n-1',
        fichaId: 'f-1',
        areaId: 2,
        contenido: 'Nota del área',
        creadoEn: '2026-11-26T10:00:00Z',
        actualizadoEn: '2026-11-26T10:00:00Z',
        creadoPor: 'emp-1',
      },
    ]);
  });

  it('crea la nota con contenido recortado y autor de la sesión', async () => {
    results.nota_area = { data: NOTA_ROW, error: null };
    await supabaseSeguimientoRepository.crearNota({ fichaId: 'f-1', areaId: 2, contenido: '  Nota  ' });
    expect(callsOf('nota_area', 'insert')[0]).toEqual([
      { ficha_id: 'f-1', area_id: 2, contenido: 'Nota', creado_por: 'emp-1' },
    ]);
  });

  it('archiva con baja lógica y lanza el error de RLS', async () => {
    await supabaseSeguimientoRepository.archivarNota('n-1');
    expect(callsOf('nota_area', 'update')[0]).toEqual([{ activo: false }]);

    results.nota_area = { data: null, error: { code: '42501', message: 'RLS' } };
    await expect(supabaseSeguimientoRepository.archivarNota('n-1')).rejects.toMatchObject({
      code: '42501',
    });
  });

  it('guarda la copia del día y un domicilio histórico no vigente cuando cambió', async () => {
    rpcMock.mockResolvedValue({
      data: [
        { atencion_id: 'at-1', cita_proxima_id: null, es_primera_vez_area: false, tiene_historial_clinico: false },
      ],
      error: null,
    });
    results.domicilio = { data: { id: 'dom-2' }, error: null };

    const result = await supabaseSeguimientoRepository.registrar({
      fichaId: 'f-1',
      citaId: 'c-1',
      tipoAtencionId: 3,
      accionesRealizadas: 'Sesión',
      copia: {
        personaId: 'p-1',
        estadoCivil: 'separado',
        ocupacionId: 4,
        ocupacionOtra: null,
        celular: '6681234567',
        domicilio: {
          asentamientoId: null,
          codigoPostalForaneo: '81200',
          calle: 'Calle Dos',
          numeroExterior: '8',
          numeroInterior: '',
          referencias: '',
          zona: 'urbana',
        },
      },
    });

    expect(result.copiaGuardada).toBe(true);
    expect(callsOf('domicilio', 'insert')[0]).toEqual([
      expect.objectContaining({ persona_id: 'p-1', codigo_postal: '81200', es_actual: false }),
    ]);
    expect(callsOf('atencion', 'update')[0]).toEqual([
      {
        estado_civil: 'separado',
        ocupacion_id: 4,
        ocupacion_otra: null,
        celular: '6681234567',
        domicilio_id: 'dom-2',
      },
    ]);
    expect(callsOf('atencion', 'eq')[0]).toEqual(['id', 'at-1']);
  });

  it('descarta de la línea de tiempo cualquier tipo desconocido', async () => {
    rpcMock.mockResolvedValue({
      data: [
        { fecha: '2026-11-26T12:00:00Z', tipo: 'nota_area', area: null, titulo: 'x', detalle: 'x', referencia_id: 'n-1' },
        { fecha: '2026-11-25T12:00:00Z', tipo: 'cita', area: 'Jurídico', titulo: 'Cita · agendada', detalle: null, referencia_id: 'c-1' },
      ],
      error: null,
    });
    const eventos = await supabaseSeguimientoRepository.getLineaTiempo('f-1');
    expect(eventos.map((e) => e.referenciaId)).toEqual(['c-1']);
  });
});
