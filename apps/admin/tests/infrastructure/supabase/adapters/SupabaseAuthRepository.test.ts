import { describe, expect, it } from 'vitest';
import { mapAuthErrorMessage, mapUmecaCitaRow } from '@/infrastructure/supabase/adapters/SupabaseAuthRepository';

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

describe('mapAuthErrorMessage', () => {
  it('explica en español una cuenta sin confirmar', () => {
    expect(mapAuthErrorMessage(400, 'Email not confirmed')).toMatch(/aún no ha sido confirmado/i);
  });

  it('explica credenciales incorrectas, rate limit y cuenta bloqueada', () => {
    expect(mapAuthErrorMessage(400, 'Invalid login credentials')).toBe('Correo o contraseña incorrectos.');
    expect(mapAuthErrorMessage(429, '')).toMatch(/demasiados intentos/i);
    expect(mapAuthErrorMessage(400, 'User is banned')).toMatch(/desactivada/i);
  });
});
