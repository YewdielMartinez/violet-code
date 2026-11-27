import { describe, expect, it } from 'vitest';
import { mapUmecaCitaRow } from '@/infrastructure/supabase/adapters/SupabaseAuthRepository';

const BASE = {
  cita_id: 'c1',
  programada_en: '2026-11-26T17:00:00Z',
  estado: 'asistio',
  nombres: 'Ana',
  apellido_paterno: 'López',
  apellido_materno: 'Pérez',
};

describe('mapUmecaCitaRow (get_umeca_citas)', () => {
  it('mapea el área que devuelve el RPC', () => {
    expect(mapUmecaCitaRow({ ...BASE, area_clave: 'psicologia', area_nombre: 'Psicología' })).toEqual({
      citaId: 'c1',
      programadaEn: '2026-11-26T17:00:00Z',
      estado: 'asistio',
      nombres: 'Ana',
      apellidoPaterno: 'López',
      apellidoMaterno: 'Pérez',
      areaClave: 'psicologia',
      areaNombre: 'Psicología',
    });
  });

  it('tolera que el RPC aún no devuelva el área o el apellido materno', () => {
    expect(mapUmecaCitaRow({ ...BASE, apellido_materno: '' })).toMatchObject({
      apellidoMaterno: null,
      areaClave: null,
      areaNombre: null,
    });
  });
});
