import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

import { supabaseExpedienteRepository } from '@/infrastructure/supabase/adapters/SupabaseExpedienteRepository';

function buildQueryMock(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (val: { data: unknown; error: unknown }) => void) =>
      Promise.resolve(resolve(result)),
  };
  return chain;
}

describe('supabaseExpedienteRepository', () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it('bloquea duplicados devolviendo expediente_existente cuando la CURP ya tiene ficha activa', async () => {
    const personaQuery = buildQueryMock({
      data: {
        id: 'persona-1',
        curp: 'GALA900512MSLNRR01',
        nombres: 'Laura',
        apellido_paterno: 'García',
        apellido_materno: 'Lara',
        sexo: 'M',
        fecha_nacimiento: '1990-05-12',
        entidad_nacimiento: 'SL',
        celular: '6680000001',
        ficha_registro: [
          {
            id: 'ficha-1',
            folio: 'SEM-2026-0001',
            estado: 'en_seguimiento',
            creado_en: '2026-11-20T10:00:00Z',
            actualizado_en: '2026-11-25T10:00:00Z',
            activo: true,
          },
        ],
      },
      error: null,
    });
    const urgenciasQuery = buildQueryMock({
      data: { ficha_id: 'ficha-1' },
      error: null,
    });

    fromMock.mockImplementation((table: string) =>
      table === 'persona' ? personaQuery : urgenciasQuery,
    );

    const outcome = await supabaseExpedienteRepository.verifyByCurp('gala900512mslnrr01', true);

    expect(outcome).toMatchObject({
      kind: 'expediente_existente',
      expediente: {
        id: 'ficha-1',
        folio: 'SEM-2026-0001',
        enListaUrgencias: true,
        persona: {
          curp: 'GALA900512MSLNRR01',
          nombreCompleto: 'Laura García Lara',
        },
      },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('consulta buscar_pre_registro_por_curp cuando no existe persona y el rol está autorizado', async () => {
    fromMock.mockReturnValue(buildQueryMock({ data: null, error: null }));
    rpcMock.mockResolvedValue({
      data: [
        {
          pre_registro_id: 'pre-99',
          curp: 'PERL021120MSLNRC09',
          nombres: 'Sofía',
          apellido_paterno: 'Pérez',
          apellido_materno: null,
          sexo: 'M',
          fecha_nacimiento: '2002-11-20',
          entidad_nacimiento: 'SL',
          celular: '6680000002',
          persona_id: null,
        },
      ],
      error: null,
    });

    const outcome = await supabaseExpedienteRepository.verifyByCurp('PERL021120MSLNRC09', true);

    expect(rpcMock).toHaveBeenCalledWith('buscar_pre_registro_por_curp', {
      p_curp: 'PERL021120MSLNRC09',
    });
    expect(outcome).toMatchObject({
      kind: 'pre_registro_movil',
      preRegistro: {
        preRegistroId: 'pre-99',
        nombreCompleto: 'Sofía Pérez',
      },
    });
  });

  it('no invoca buscar_pre_registro_por_curp cuando el rol no tiene permiso de precarga móvil', async () => {
    fromMock.mockReturnValue(buildQueryMock({ data: null, error: null }));

    const outcome = await supabaseExpedienteRepository.verifyByCurp('PERL021120MSLNRC09', false);

    expect(rpcMock).not.toHaveBeenCalled();
    expect(outcome).toEqual({ kind: 'nuevo', curp: 'PERL021120MSLNRC09' });
  });

  it('registra en bitacora_acceso la apertura de un expediente mediante registrar_consulta', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await supabaseExpedienteRepository.registerConsult('ficha-123');

    expect(rpcMock).toHaveBeenCalledWith('registrar_consulta', {
      p_tabla: 'ficha_registro',
      p_registro_id: 'ficha-123',
    });
  });
});
