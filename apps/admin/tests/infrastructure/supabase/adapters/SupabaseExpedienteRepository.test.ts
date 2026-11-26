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

  it('usa buscar_expedientes cuando la búsqueda tiene 3 o más caracteres', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          ficha_id: 'ficha-1',
          folio: 'SEM-2026-0001',
          estado: 'en_seguimiento',
          persona_id: 'persona-1',
          curp: 'GALA900512MSLNRR01',
          nombre_completo: 'Laura García Lara',
          sexo: 'M',
          fecha_nacimiento: '1990-05-12',
          en_lista_urgencias: true,
          coincidencia: 'nombre',
          similitud: 0.9,
        },
      ],
      error: null,
    });

    const items = await supabaseExpedienteRepository.list('Laura');

    expect(rpcMock).toHaveBeenCalledWith('buscar_expedientes', {
      p_termino: 'Laura',
      p_limite: 100,
      p_incluir_archivados: true,
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'ficha-1',
      folio: 'SEM-2026-0001',
      enListaUrgencias: true,
      persona: {
        curp: 'GALA900512MSLNRR01',
        nombreCompleto: 'Laura García Lara',
        entidadNacimiento: 'SL',
      },
    });
  });

  it('bloquea duplicados devolviendo expediente_existente vía verificar_curp', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          resultado: 'expediente_existente',
          persona_id: 'persona-1',
          ficha_id: 'ficha-1',
          folio: 'SEM-2026-0001',
          estado: 'en_seguimiento',
          nombre_completo: 'Laura García Lara',
          pre_registro_id: null,
        },
      ],
      error: null,
    });
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

    expect(rpcMock).toHaveBeenCalledWith('verificar_curp', { p_curp: 'GALA900512MSLNRR01' });
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
  });

  it('consulta buscar_pre_registro_por_curp cuando verificar_curp devuelve pre_registro_movil', async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: [
          {
            resultado: 'pre_registro_movil',
            persona_id: null,
            ficha_id: null,
            folio: null,
            estado: null,
            nombre_completo: 'Sofía Pérez',
            pre_registro_id: 'pre-99',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
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

    expect(rpcMock).toHaveBeenNthCalledWith(1, 'verificar_curp', { p_curp: 'PERL021120MSLNRC09' });
    expect(rpcMock).toHaveBeenNthCalledWith(2, 'buscar_pre_registro_por_curp', {
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
    rpcMock.mockResolvedValue({
      data: [{ resultado: 'pre_registro_movil', pre_registro_id: 'pre-99' }],
      error: null,
    });

    const outcome = await supabaseExpedienteRepository.verifyByCurp('PERL021120MSLNRC09', false);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ kind: 'nuevo', curp: 'PERL021120MSLNRC09' });
  });

  it('devuelve persona_sin_ficha con datos básicos si RLS oculta persona', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          resultado: 'persona_sin_ficha',
          persona_id: 'persona-2',
          ficha_id: null,
          folio: null,
          estado: null,
          nombre_completo: 'María López',
          pre_registro_id: null,
        },
      ],
      error: null,
    });
    fromMock.mockReturnValue(buildQueryMock({ data: null, error: null }));

    const outcome = await supabaseExpedienteRepository.verifyByCurp('LOMM950101MSLRRR01', false);

    expect(outcome).toMatchObject({
      kind: 'persona_sin_ficha',
      persona: {
        id: 'persona-2',
        nombreCompleto: 'María López',
      },
    });
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
