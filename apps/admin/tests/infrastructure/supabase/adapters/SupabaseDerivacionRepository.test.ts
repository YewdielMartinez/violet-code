import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    from: fromMock,
  },
}));

import { supabaseDerivacionRepository } from '@/infrastructure/supabase/adapters/SupabaseDerivacionRepository';

function createChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (val: { data: unknown; error: unknown }) => void) => Promise.resolve(resolve(result)),
  };
  return chain;
}

describe('supabaseDerivacionRepository', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('inserta derivación interna anulando campos de institución externa', async () => {
    const chain = createChain({ data: { id: 'der-1' }, error: null });
    fromMock.mockReturnValue(chain);

    const res = await supabaseDerivacionRepository.create({
      fichaId: 'ficha-1',
      areaOrigenId: 1,
      destino: 'psicologia',
      areaDestinoId: 2,
      institucionId: 99,
      institucionOtra: 'Ignorar',
      motivo: 'Atención psicológica inicial',
    });

    expect(res).toEqual({ id: 'der-1' });
    expect(chain.insert).toHaveBeenCalledWith({
      ficha_id: 'ficha-1',
      area_origen_id: 1,
      destino: 'psicologia',
      area_destino_id: 2,
      institucion_id: null,
      institucion_otra: null,
      motivo: 'Atención psicológica inicial',
    });
  });

  it('mapea derivaciones con folio y nombre de usuaria y actualiza estado', async () => {
    const chain = createChain({
      data: [
        {
          id: 'der-2',
          ficha_id: 'ficha-1',
          area_origen_id: 1,
          area_destino_id: 2,
          institucion_id: null,
          destino: 'psicologia',
          institucion_otra: null,
          motivo: 'Seguimiento emocional',
          fecha_derivacion: '2026-11-26',
          estado: 'pendiente',
          creado_en: '2026-11-26T00:00:00Z',
          ficha_registro: {
            folio: 'SEM-2026-0001',
            persona: { nombres: 'Laura', apellido_paterno: 'García', apellido_materno: null },
          },
          area_origen: { nombre: 'Trabajo Social' },
          area_destino: { nombre: 'Psicología' },
          directorio_institucion: null,
        },
      ],
      error: null,
    });
    fromMock.mockReturnValue(chain);

    const rows = await supabaseDerivacionRepository.list();
    expect(rows[0]).toMatchObject({
      id: 'der-2',
      folio: 'SEM-2026-0001',
      usuariaNombre: 'Laura García',
      areaOrigenNombre: 'Trabajo Social',
      areaDestinoNombre: 'Psicología',
    });

    await supabaseDerivacionRepository.updateEstado('der-2', 'concluida');
    expect(chain.update).toHaveBeenCalledWith({ estado: 'concluida' });
  });
});
