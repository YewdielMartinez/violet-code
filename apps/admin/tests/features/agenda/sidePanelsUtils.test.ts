import { describe, expect, it } from 'vitest';
import type { AgendaItem } from '@/domain/models/Cita';
import {
  areaLabel,
  diasDeEspera,
  filtrarCitasPorConfirmar,
  isTomorrow,
  telHref,
  tomorrowRange,
} from '@/features/agenda/sidePanelsUtils';

const NOW = new Date(2026, 10, 26, 15, 30); // 26 nov 2026, 15:30 local

function cita(id: string, programadaEn: Date, estado: AgendaItem['estado'] = 'agendada'): AgendaItem {
  return {
    citaId: id,
    programadaEn: programadaEn.toISOString(),
    estado,
    prioridad: null,
    areaId: 1,
    areaClave: 'psicologia',
    recomendadaPor: null,
    reagendadaDe: null,
    origen: 'regular',
    personaId: `p-${id}`,
    nombreCompleto: `Persona ${id}`,
    celular: '6671234567',
  };
}

describe('tomorrowRange / isTomorrow', () => {
  it('cubre exactamente el día siguiente en hora local', () => {
    const r = tomorrowRange(NOW);
    expect(r.key).toBe('2026-11-27');
    expect(new Date(r.desde).getTime()).toBe(new Date(2026, 10, 27).getTime());
    expect(new Date(r.hasta).getTime()).toBe(new Date(2026, 10, 28).getTime());
  });

  it('incluye 00:00 y 23:59 de mañana, excluye hoy y pasado mañana', () => {
    expect(isTomorrow(new Date(2026, 10, 27, 0, 0).toISOString(), NOW)).toBe(true);
    expect(isTomorrow(new Date(2026, 10, 27, 23, 59).toISOString(), NOW)).toBe(true);
    expect(isTomorrow(new Date(2026, 10, 26, 23, 59).toISOString(), NOW)).toBe(false);
    expect(isTomorrow(new Date(2026, 10, 28, 0, 0).toISOString(), NOW)).toBe(false);
    expect(isTomorrow('no-es-fecha', NOW)).toBe(false);
  });

  it('resuelve el cambio de mes', () => {
    expect(tomorrowRange(new Date(2026, 10, 30, 9)).key).toBe('2026-12-01');
  });
});

describe('filtrarCitasPorConfirmar', () => {
  it('conserva solo agendadas de mañana, ordenadas por hora', () => {
    const items = [
      cita('tarde', new Date(2026, 10, 27, 16, 0)),
      cita('hoy', new Date(2026, 10, 26, 18, 0)),
      cita('confirmada', new Date(2026, 10, 27, 10, 0), 'confirmada'),
      cita('cancelada', new Date(2026, 10, 27, 11, 0), 'cancelada'),
      cita('manana', new Date(2026, 10, 27, 9, 0)),
      cita('pasado', new Date(2026, 10, 28, 9, 0)),
    ];
    expect(filtrarCitasPorConfirmar(items, NOW).map((c) => c.citaId)).toEqual(['manana', 'tarde']);
  });

  it('no muta el arreglo original', () => {
    const items = [cita('b', new Date(2026, 10, 27, 12)), cita('a', new Date(2026, 10, 27, 8))];
    filtrarCitasPorConfirmar(items, NOW);
    expect(items.map((c) => c.citaId)).toEqual(['b', 'a']);
  });
});

describe('helpers de presentación', () => {
  it('areaLabel', () => {
    expect(areaLabel('trabajo_social')).toBe('Trabajo social');
    expect(areaLabel('psicologia')).toBe('Psicología');
    expect(areaLabel('otra_area')).toBe('Otra area');
  });

  it('telHref ignora celulares inválidos', () => {
    expect(telHref('(667) 123-4567')).toBe('tel:6671234567');
    expect(telHref('12')).toBeNull();
    expect(telHref(null)).toBeNull();
  });

  it('diasDeEspera cuenta días calendario locales', () => {
    expect(diasDeEspera('2026-11-26', NOW)).toBe(0);
    expect(diasDeEspera('2026-11-21', NOW)).toBe(5);
    expect(diasDeEspera('2027-01-01', NOW)).toBe(0);
  });
});
