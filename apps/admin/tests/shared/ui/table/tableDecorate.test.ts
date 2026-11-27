import { describe, expect, it } from 'vitest';
import { createRowDecorator, decoratePillCell, pillElement } from '@/shared/ui/table/tableDecorate';

function tbodyOf(html: string): HTMLTableSectionElement {
  const tbody = document.createElement('tbody');
  tbody.innerHTML = html;
  return tbody;
}

describe('pillElement', () => {
  it('dibuja punto + texto con el tono y no depende solo del color', () => {
    const pill = pillElement('Abierto', 'info');
    expect(pill.className).toBe('vc-dt-pill vc-dt-pill--info');
    expect(pill.querySelector('.vc-dt-pill__dot')?.getAttribute('aria-hidden')).toBe('true');
    expect(pill.textContent).toBe('Abierto');
  });

  it('con ícono usa Material Symbols en lugar del punto', () => {
    const pill = pillElement('Asistió', 'success', 'event_available');
    expect(pill.querySelector('.vc-dt-pill__dot')).toBeNull();
    expect(pill.querySelector('.mk-icon')?.textContent).toBe('event_available');
  });
});

describe('decoratePillCell', () => {
  const spec = { tones: { Pendiente: 'info', Vencida: 'warning' } } as const;

  it('reemplaza el texto y es idempotente', () => {
    const td = document.createElement('td');
    td.textContent = 'Pendiente';
    decoratePillCell(td, spec);
    decoratePillCell(td, spec);
    expect(td.querySelectorAll('.vc-dt-pill')).toHaveLength(1);
    expect(td.querySelector('.vc-dt-pill--info')?.textContent).toBe('Pendiente');
  });

  it('usa neutral para textos sin tono y respeta `fallback`', () => {
    const a = document.createElement('td');
    a.textContent = 'Otro';
    decoratePillCell(a, spec);
    expect(a.querySelector('.vc-dt-pill--neutral')).not.toBeNull();
    const b = document.createElement('td');
    b.textContent = 'Otro';
    decoratePillCell(b, { ...spec, fallback: 'danger' });
    expect(b.querySelector('.vc-dt-pill--danger')).not.toBeNull();
  });

  it('con `split` dibuja una cápsula por fragmento dentro de .vc-pills', () => {
    const td = document.createElement('td');
    td.textContent = 'Pendiente · Vencida';
    decoratePillCell(td, { ...spec, split: true });
    expect(td.querySelector('.vc-pills')).not.toBeNull();
    expect(Array.from(td.querySelectorAll('.vc-dt-pill')).map((p) => p.className)).toEqual([
      'vc-dt-pill vc-dt-pill--info',
      'vc-dt-pill vc-dt-pill--warning',
    ]);
  });

  it('ignora celdas vacías o inexistentes', () => {
    const td = document.createElement('td');
    td.textContent = '   ';
    decoratePillCell(td, spec);
    decoratePillCell(null, spec);
    expect(td.querySelector('.vc-dt-pill')).toBeNull();
  });
});

describe('createRowDecorator', () => {
  const decorate = createRowDecorator({
    pills: { estado: { tones: { Abierto: 'info' } } },
    strong: ['nombre'],
    mono: ['folio'],
    muted: ['fecha'],
    truncate: ['nota'],
    interactive: true,
  });
  const row = `<tr data-id="1">
      <td data-key="folio">EXP-1</td><td data-key="nombre">Ana</td><td data-key="estado">Abierto</td>
      <td data-key="fecha">1 nov</td><td data-key="nota"> Una nota muy larga </td>
    </tr>`;

  it('aplica énfasis, cápsulas, truncado con title y hace enfocable la fila', () => {
    const tbody = tbodyOf(row);
    decorate(tbody);
    const tr = tbody.rows[0];
    expect(tr.tabIndex).toBe(0);
    expect(tr.querySelector('[data-key="nombre"]')?.classList.contains('vc-table__strong')).toBe(true);
    expect(tr.querySelector('[data-key="folio"]')?.classList.contains('vc-table__mono')).toBe(true);
    expect(tr.querySelector('[data-key="fecha"]')?.classList.contains('vc-table__muted')).toBe(true);
    const nota = tr.querySelector<HTMLElement>('[data-key="nota"]')!;
    expect(nota.classList.contains('vc-table__trunc')).toBe(true);
    expect(nota.title).toBe('Una nota muy larga');
    expect(tr.querySelector('[data-key="estado"] .vc-dt-pill--info')).not.toBeNull();
  });

  it('es idempotente y vuelve a decorar una celda que el kit reescribió', () => {
    const tbody = tbodyOf(row);
    decorate(tbody);
    decorate(tbody);
    expect(tbody.querySelectorAll('.vc-dt-pill')).toHaveLength(1);

    // El kit reescribe la celda (búsqueda, orden): la cápsula se pierde y `onRender` la repone.
    tbody.querySelector('[data-key="estado"]')!.textContent = 'Abierto';
    expect(tbody.querySelector('.vc-dt-pill')).toBeNull();
    decorate(tbody);
    expect(tbody.querySelectorAll('.vc-dt-pill')).toHaveLength(1);
  });

  it('omite filas sin id y filas de esqueleto de carga', () => {
    const tbody = tbodyOf(
      `<tr><td data-key="estado">Abierto</td></tr>
       <tr data-id="2" data-mk-dt-loading><td data-key="estado">Abierto</td></tr>`,
    );
    decorate(tbody);
    expect(tbody.querySelector('.vc-dt-pill')).toBeNull();
    expect(tbody.rows[1].tabIndex).toBe(-1);
  });

  it('sin `interactive` no pone tabindex', () => {
    const tbody = tbodyOf(row);
    createRowDecorator({ strong: ['nombre'] })(tbody);
    expect(tbody.rows[0].hasAttribute('tabindex')).toBe(false);
  });
});
