import { describe, expect, it } from 'vitest';
import type { AgendaItem } from '@/domain/models/Cita';
import {
  addDays,
  addMonths,
  citaTone,
  dayKey,
  esCitaVisible,
  formatMonthTitle,
  formatWeekTitle,
  groupCitasByDay,
  layoutWeekDay,
  monthGridDays,
  monthGridRanges,
  parseDayKey,
  weekDays,
  weekRange,
} from '@/features/agenda/agendaDates';
import { areaScopeFor } from '@/features/agenda/agendaScope';

function cita(id: string, iso: string, extra: Partial<AgendaItem> = {}): AgendaItem {
  return {
    citaId: id,
    programadaEn: iso,
    estado: 'agendada',
    prioridad: null,
    areaId: 1,
    areaClave: 'psicologia',
    recomendadaPor: null,
    reagendadaDe: null,
    origen: 'regular',
    personaId: `p-${id}`,
    nombreCompleto: `Persona ${id}`,
    celular: null,
    ...extra,
  };
}

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString();

describe('cuadrícula mensual', () => {
  it('arranca en domingo y tiene 6 semanas (42 días) consecutivas', () => {
    const days = monthGridDays(new Date(2026, 10, 26)); // noviembre 2026
    expect(days).toHaveLength(42);
    expect(days.every((d, i) => d.getDay() === i % 7)).toBe(true);
    expect(dayKey(days[0])).toBe('2026-11-01'); // 1 nov 2026 es domingo
    expect(dayKey(days[41])).toBe('2026-12-12');
  });

  it('incluye los días finales del mes anterior cuando el 1 no es domingo', () => {
    const days = monthGridDays(new Date(2026, 8, 15)); // septiembre 2026 (1 sep = martes)
    expect(dayKey(days[0])).toBe('2026-08-30');
    expect(days[0].getDay()).toBe(0);
    expect(dayKey(days[41])).toBe('2026-10-10');
  });

  it('parte el rango en dos tramos de 21 días (el RPC admite máx. 31)', () => {
    const [a, b] = monthGridRanges(new Date(2026, 10, 1));
    expect(a.hasta).toBe(b.desde);
    expect(Date.parse(a.hasta) - Date.parse(a.desde)).toBeLessThanOrEqual(31 * 24 * 3600_000);
    expect(new Date(a.desde).getTime()).toBe(new Date(2026, 10, 1).getTime());
    expect(new Date(b.hasta).getTime()).toBe(new Date(2026, 11, 13).getTime());
  });

  it('addMonths cruza de año y addDays es seguro con cambio de horario', () => {
    expect(dayKey(addMonths(new Date(2026, 11, 20), 1))).toBe('2027-01-01');
    expect(dayKey(addMonths(new Date(2026, 0, 20), -1))).toBe('2025-12-01');
    expect(dayKey(addDays(new Date(2026, 2, 7), 2))).toBe('2026-03-09');
  });
});

describe('rango semanal', () => {
  it('de domingo a sábado y un rango exacto de 7 días', () => {
    const days = weekDays(new Date(2026, 9, 1)); // jueves 1 oct 2026
    expect(days.map(dayKey)).toEqual([
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
    const range = weekRange(new Date(2026, 9, 1));
    expect(new Date(range.desde).getTime()).toBe(new Date(2026, 8, 27).getTime());
    expect(new Date(range.hasta).getTime()).toBe(new Date(2026, 9, 4).getTime());
  });

  it('formatea los títulos en español', () => {
    expect(formatMonthTitle(new Date(2026, 10, 5))).toBe('Noviembre de 2026');
    expect(formatWeekTitle(weekDays(new Date(2026, 9, 1)))).toMatch(/^27 sep?t?\.? – 3 oct 2026$/);
  });

  it('parseDayKey es inverso de dayKey sin desfase de zona horaria', () => {
    expect(dayKey(parseDayKey('2026-11-30'))).toBe('2026-11-30');
    expect(parseDayKey('2026-11-30').getDate()).toBe(30);
  });
});

describe('agrupar citas por día local', () => {
  it('agrupa por día y ordena por hora', () => {
    const groups = groupCitasByDay([
      cita('c', local(2026, 11, 26, 15, 30)),
      cita('a', local(2026, 11, 26, 9)),
      cita('b', local(2026, 11, 27, 8)),
    ]);
    expect([...groups.keys()].sort()).toEqual(['2026-11-26', '2026-11-27']);
    expect(groups.get('2026-11-26')?.map((c) => c.citaId)).toEqual(['a', 'c']);
  });

  it('una cita a las 23:30 locales queda en su día aunque en UTC ya sea el siguiente', () => {
    const groups = groupCitasByDay([cita('x', local(2026, 11, 26, 23, 30))]);
    expect(groups.has('2026-11-26')).toBe(true);
    expect(groups.size).toBe(1);
  });

  it('las citas reagendadas no se dibujan; las canceladas sí (apagadas)', () => {
    expect(esCitaVisible(cita('r', local(2026, 11, 1), { estado: 'reagendada' }))).toBe(false);
    expect(esCitaVisible(cita('c', local(2026, 11, 1), { estado: 'cancelada' }))).toBe(true);
  });
});

describe('colores y carriles', () => {
  it('prioridad alta destaca; canceladas y no asistió se apagan', () => {
    expect(citaTone({ estado: 'agendada', prioridad: 'alta' })).toBe('urgent');
    expect(citaTone({ estado: 'confirmada', prioridad: null })).toBe('confirmed');
    expect(citaTone({ estado: 'agendada', prioridad: 'baja' })).toBe('pending');
    expect(citaTone({ estado: 'asistio', prioridad: 'alta' })).toBe('done');
    expect(citaTone({ estado: 'cancelada', prioridad: 'alta' })).toBe('muted');
    expect(citaTone({ estado: 'no_asistio', prioridad: null })).toBe('muted');
  });

  it('posiciona por hora y reparte en carriles las citas simultáneas', () => {
    const layout = layoutWeekDay([
      cita('a', local(2026, 11, 26, 9)),
      cita('b', local(2026, 11, 26, 9, 30)),
      cita('c', local(2026, 11, 26, 11)),
    ]);
    const byId = Object.fromEntries(layout.map((l) => [l.cita.citaId, l]));
    expect(byId.a.topMinutes).toBe(3 * 60);
    expect(byId.a.lanes).toBe(2);
    expect(byId.b.lane).toBe(1);
    expect(byId.c.lanes).toBe(1);
    expect(byId.c.topMinutes).toBe(5 * 60);
  });

  it('acota citas fuera de 06:00–20:59 a la rejilla visible', () => {
    const [early] = layoutWeekDay([cita('e', local(2026, 11, 26, 5, 15))]);
    const [late] = layoutWeekDay([cita('l', local(2026, 11, 26, 22))]);
    expect(early.topMinutes).toBe(0);
    expect(late.topMinutes).toBe(14 * 60);
  });
});

describe('alcance de áreas por rol', () => {
  it('dirección ve todas; recepción también Jurídico; trabajo social solo TS y psicología; el resto su área', () => {
    expect(areaScopeFor('titular', null)).toEqual({ kind: 'all' });
    expect(areaScopeFor('subdireccion', null)).toEqual({ kind: 'all' });
    expect(areaScopeFor('recepcion', null)).toEqual({ kind: 'claves', claves: ['trabajo_social', 'psicologia', 'juridico'] });
    expect(areaScopeFor('trabajo_social', 1)).toEqual({ kind: 'claves', claves: ['trabajo_social', 'psicologia'] });
    expect(areaScopeFor('juridico', 3)).toEqual({ kind: 'own', areaId: 3 });
    expect(areaScopeFor('psicologia', 2)).toEqual({ kind: 'own', areaId: 2 });
  });
});
