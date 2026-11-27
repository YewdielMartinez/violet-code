import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { VcDataTable } from '@/shared/ui/table/VcDataTable';
import { setTableDensity } from '@/shared/ui/table/useTableDensity';
import { numericColumn } from '@/shared/ui/table/tableFormat';

type Fila = { id: string; nombre: string; estado: string; total: number } & Record<string, unknown>;

const COLUMNS = [
  { key: 'nombre', label: 'Nombre', sortable: true },
  { key: 'estado', label: 'Estado' },
  numericColumn<Fila>('total', 'Total'),
];
const ROWS: Fila[] = Array.from({ length: 12 }, (_, i) => ({
  id: String(i),
  nombre: `Persona ${i}`,
  estado: i % 2 ? 'Abierto' : 'Cerrado',
  total: i * 1000,
}));
const PILLS = { estado: { tones: { Abierto: 'info', Cerrado: 'success' } } } as const;

describe('VcDataTable', () => {
  afterEach(() => {
    cleanup();
    setTableDensity('regular');
    localStorage.clear();
  });

  it('aplica la clase vc-table, el pie «1–10 de 12» en español, bandas y la decoración de filas', async () => {
    const { container } = render(
      <VcDataTable<Fila> caption="Prueba" rows={ROWS} columns={COLUMNS} pills={PILLS} strong={['nombre']} interactive />,
    );
    const root = container.querySelector('.mk-data-table')!;
    expect(root.classList.contains('vc-table')).toBe(true);
    expect(root.classList.contains('vc-table--interactive')).toBe(true);
    expect(root.hasAttribute('data-striped')).toBe(true);
    expect(root.querySelector('[data-mk-dt-range]')?.textContent).toBe('1–10 de 12');
    expect(root.querySelector('[data-mk-dt-page]')?.textContent).toBe('Página 1 de 2');
    expect(root.querySelectorAll('tbody td[data-key="estado"] .vc-dt-pill')).toHaveLength(10);
    expect(root.querySelector('tbody tr[data-id]')?.getAttribute('tabindex')).toBe('0');
    expect(root.querySelector('td[data-key="nombre"]')?.classList.contains('vc-table__strong')).toBe(true);
    // Columna numérica a la derecha.
    expect(root.querySelector('td[data-key="total"]')?.getAttribute('data-align')).toBe('end');
    await waitFor(() => expect(screen.getByRole('button', { name: /Densidad cómoda/ })).toBeTruthy());
  });

  it('el botón de densidad alterna cómoda ↔ compacta y marca la tabla', async () => {
    const { container } = render(<VcDataTable<Fila> caption="Prueba" rows={ROWS} columns={COLUMNS} />);
    const root = container.querySelector('.mk-data-table')!;
    expect(root.getAttribute('data-density')).toBeNull();

    fireEvent.click(await screen.findByRole('button', { name: /Densidad cómoda/ }));
    await waitFor(() => expect(root.getAttribute('data-density')).toBe('compact'));
    expect(screen.getByRole('button', { name: /Densidad compacta/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('respeta `densityToggle={false}`', () => {
    render(<VcDataTable<Fila> caption="Prueba" rows={ROWS} columns={COLUMNS} densityToggle={false} />);
    expect(screen.queryByRole('button', { name: /Densidad/ })).toBeNull();
  });
});
