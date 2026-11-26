import { describe, expect, it } from 'vitest';
import { validarTransicionCita, validateCitaCreate } from '@/domain/models/Cita';

describe('Cita (reglas RF-06 / RN-04 / RN-06)', () => {
  it('valida campos obligatorios y formato al agendar una cita', () => {
    expect(
      validateCitaCreate({
        personaId: '',
        areaId: 1,
        programadaEn: '2026-12-03T10:00:00-07:00',
      }),
    ).toMatch(/persona/i);

    expect(
      validateCitaCreate({
        personaId: 'per-1',
        areaId: 0,
        programadaEn: '2026-12-03T10:00:00-07:00',
      }),
    ).toMatch(/área/i);

    expect(
      validateCitaCreate({
        personaId: 'per-1',
        areaId: 2,
        programadaEn: 'fecha-invalida',
      }),
    ).toMatch(/fecha y hora/i);

    expect(
      validateCitaCreate({
        personaId: 'per-1',
        areaId: 2,
        programadaEn: '2026-12-03T10:00:00-07:00',
        recomendadaPor: 'a'.repeat(151),
      }),
    ).toMatch(/150 caracteres/i);

    expect(
      validateCitaCreate({
        personaId: 'per-1',
        areaId: 2,
        programadaEn: '2026-12-03T10:00:00-07:00',
        prioridad: 'alta',
        recomendadaPor: 'Trabajo Social',
      }),
    ).toBeNull();
  });

  it('permite transiciones válidas hacia confirmada, cancelada y no_asistio', () => {
    expect(validarTransicionCita('agendada', 'confirmada')).toBeNull();
    expect(validarTransicionCita('agendada', 'cancelada', 'Motivo familiar')).toBeNull();
    expect(validarTransicionCita('agendada', 'no_asistio')).toBeNull();
    expect(validarTransicionCita('confirmada', 'cancelada')).toBeNull();
    expect(validarTransicionCita('confirmada', 'no_asistio')).toBeNull();
  });

  it('rechaza transiciones inválidas, estados terminales y motivo mayor a 500 caracteres', () => {
    expect(validarTransicionCita('confirmada', 'confirmada')).toMatch(/ya se encuentra/i);
    expect(validarTransicionCita('cancelada', 'no_asistio')).toMatch(/no permitida/i);
    expect(validarTransicionCita('asistio', 'cancelada')).toMatch(/no permitida/i);
    expect(validarTransicionCita('reagendada', 'confirmada')).toMatch(/no permitida/i);
    expect(validarTransicionCita('agendada', 'cancelada', 'x'.repeat(501))).toMatch(/500 caracteres/i);
  });
});
