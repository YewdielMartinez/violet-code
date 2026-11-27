import { describe, expect, it } from 'vitest';
import { decorateActividadRows, toActividadRow } from '@/features/actividades/actividadesTableConfig';
import { act } from './fixtures';

// Jueves 3 dic 2026, 10:00 en Mazatlán.
const AHORA = new Date('2026-12-03T17:00:00Z');

describe('toActividadRow', () => {
  it('arma fecha y hora de Mazatlán, ubicación, institución con nivel y asistentes', () => {
    const row = toActividadRow(
      act('1', '2026-12-04T17:30:00Z', {
        titulo: 'Noviazgo sin violencia',
        sede: 'Secundaria 12',
        asentamientoNombre: 'Centro',
        municipio: 'Ahome',
        nivelEducativo: 'secundaria',
        numeroAsistentes: 40,
      }),
      AHORA,
    );

    expect(row).toMatchObject({
      id: '1',
      programadaEn: '2026-12-04T17:30:00Z',
      fechaLabel: '04 dic 2026 · 10:30',
      titulo: 'Noviazgo sin violencia',
      sede: 'Secundaria 12',
      ubicacion: 'Centro, Ahome',
      tipoActividad: 'Taller',
      estado: 'Pendiente',
      vencida: false,
      asistentes: 40,
    });
    expect(row.institucion).toMatch(/^Escuela · /);
  });

  it('sin ubicación muestra «—» y solo una pendiente con fecha pasada es vencida', () => {
    expect(toActividadRow(act('a', '2026-12-10T17:00:00Z'), AHORA)).toMatchObject({ ubicacion: '—', vencida: false });
    expect(toActividadRow(act('b', '2026-11-30T17:00:00Z'), AHORA).vencida).toBe(true);
    expect(toActividadRow(act('c', '2026-11-30T17:00:00Z', { estado: 'realizada' }), AHORA)).toMatchObject({
      estado: 'Realizada',
      vencida: false,
    });
  });
});

describe('decorateActividadRows', () => {
  function tabla(estado: string, institucion: string) {
    const tbody = document.createElement('tbody');
    tbody.innerHTML = `<tr data-id="1"><td data-key="estado">${estado}</td><td data-key="institucion">${institucion}</td></tr>`;
    return tbody;
  }

  it('hace enfocable la fila y reemplaza estado e institución por cápsulas (una por fragmento)', () => {
    const tbody = tabla('Pendiente · Vencida', 'Escuela');
    decorateActividadRows(tbody);

    const tr = tbody.rows[0];
    expect(tr.tabIndex).toBe(0);
    const pills = tr.querySelectorAll('td[data-key="estado"] .vc-dt-pill');
    expect(Array.from(pills).map((p) => [p.className, p.textContent])).toEqual([
      ['vc-dt-pill vc-dt-pill--info', 'Pendiente'],
      ['vc-dt-pill vc-dt-pill--warning', 'Vencida'],
    ]);
    expect(tr.querySelector('td[data-key="institucion"] .vc-dt-pill--neutral')?.textContent).toBe('Escuela');
  });

  it('es idempotente: no duplica cápsulas al renderizar de nuevo', () => {
    const tbody = tabla('Cancelada', 'Empresa privada');
    decorateActividadRows(tbody);
    decorateActividadRows(tbody);

    expect(tbody.querySelectorAll('td[data-key="estado"] .vc-dt-pill')).toHaveLength(1);
    expect(tbody.querySelector('td[data-key="estado"] .vc-dt-pill--danger')).not.toBeNull();
  });
});
