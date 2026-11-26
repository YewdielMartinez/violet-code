import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    from: fromMock,
  },
}));

import { supabaseDirectorioRepository } from '@/infrastructure/supabase/adapters/SupabaseDirectorioRepository';

function buildQueryMock(result: { data: unknown[] | null; error: unknown }) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    then: (resolve: (val: { data: unknown[] | null; error: unknown }) => void) =>
      Promise.resolve(resolve(result)),
  };
  return chain;
}

describe('supabaseDirectorioRepository', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('omite siempre la dirección en registros con categoría refugio', async () => {
    const query = buildQueryMock({
      data: [
        {
          id: 1,
          nombre: 'Refugio Confidencial',
          categoria: 'refugio',
          telefono: '6680000001',
          horario: '24 horas',
          es_24_horas: true,
          calle: 'Calle Secreta',
          numero_exterior: '123',
          numero_interior: null,
          codigo_postal: '81200',
          orden: 1,
          cat_asentamiento: { nombre: 'Centro' },
        },
        {
          id: 2,
          nombre: 'SEMUJERES Ahome',
          categoria: 'emergencia',
          telefono: '6680000002',
          horario: 'L-V 8:00-16:00',
          es_24_horas: false,
          calle: 'Av. Gabriel Leyva',
          numero_exterior: '450',
          numero_interior: 'B',
          codigo_postal: '81200',
          orden: 2,
          cat_asentamiento: { nombre: 'Centro' },
        },
      ],
      error: null,
    });
    fromMock.mockReturnValue(query);

    const rows = await supabaseDirectorioRepository.listar();

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: 1,
      categoria: 'refugio',
      direccion: null,
      es24Horas: true,
    });
    expect(rows[1]).toMatchObject({
      id: 2,
      categoria: 'emergencia',
      direccion: 'Av. Gabriel Leyva, 450, B, Centro, 81200',
      es24Horas: false,
    });
  });

  it('propaga errores devueltos por Supabase', async () => {
    const dbError = { message: 'permission denied' };
    fromMock.mockReturnValue(buildQueryMock({ data: null, error: dbError }));

    await expect(supabaseDirectorioRepository.listar('emergencia')).rejects.toEqual(dbError);
  });
});
