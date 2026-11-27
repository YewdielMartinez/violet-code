import { describe, expect, it } from 'vitest';
import {
  mapAuthErrorMessage,
  mapMiPerfilToStaffUser,
  mapUmecaCitaRow,
} from '@/infrastructure/supabase/adapters/SupabaseAuthRepository';

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

describe('mapMiPerfilToStaffUser (get_mi_perfil)', () => {
  it('mapea un empleado activo con permisos y dependencia nula', () => {
    expect(
      mapMiPerfilToStaffUser(
        {
          id: 'u-1',
          email: 'ts@semujeres.local',
          nombre: 'Trabajo Social',
          tipo: 'empleado',
          rol: 'trabajo_social',
          area_id: 1,
          area_clave: 'trabajo_social',
          area_nombre: 'Trabajo Social',
          dependencia: null,
          activo: true,
          permisos: ['expediente.ver', 'expediente.escribir'],
        },
        'fallback@semujeres.local',
      ),
    ).toEqual({
      id: 'u-1',
      email: 'ts@semujeres.local',
      displayName: 'Trabajo Social',
      role: 'trabajo_social',
      areaId: 1,
      areaClave: 'trabajo_social',
      areaNombre: 'Trabajo Social',
      dependencia: null,
      activo: true,
      permisos: ['expediente.ver', 'expediente.escribir'],
    });
  });

  it('usa fallbackEmail si email viene vacío y normaliza permisos nulos', () => {
    expect(
      mapMiPerfilToStaffUser(
        {
          id: 'u-2',
          email: '',
          nombre: 'Operador UMECA',
          tipo: 'externo',
          rol: 'umeca',
          area_id: null,
          area_clave: 'umeca',
          area_nombre: 'UMECA',
          dependencia: 'umeca',
          activo: true,
          permisos: null as unknown as string[],
        },
        'umeca@semujeres.local',
      ),
    ).toMatchObject({
      email: 'umeca@semujeres.local',
      role: 'umeca',
      dependencia: 'umeca',
      permisos: [],
    });
  });
});
