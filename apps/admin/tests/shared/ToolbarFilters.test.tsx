import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ToolbarFilterMenu } from '@/shared/ui/ToolbarFilterMenu';
import { ToolbarSearch } from '@/shared/ui/ToolbarSearch';

afterEach(cleanup);

const OPTIONS = [
  { value: 'todos', label: 'Todos', count: 5 },
  { value: 'abierto', label: 'Abiertos', count: 2 },
];

function SingleHarness() {
  const [v, setV] = useState('todos');
  return <ToolbarFilterMenu label="Estado" options={OPTIONS} value={v} defaultValue="todos" onChange={setV} />;
}

function MultiHarness() {
  const [v, setV] = useState<string[]>([]);
  return <ToolbarFilterMenu multiple label="Canal" options={OPTIONS} value={v} onChange={setV} />;
}

function SearchHarness() {
  const [v, setV] = useState('');
  return <ToolbarSearch value={v} onChange={setV} label="Buscar alertas" />;
}

describe('ToolbarFilterMenu', () => {
  it('expone el menú como botón con aria-haspopup y aria-expanded', () => {
    render(<SingleHarness />);
    const trigger = screen.getByRole('button', { name: 'Estado' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('en selección única muestra el valor y el contador al elegir una opción', () => {
    render(<SingleHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Estado' }));
    fireEvent.click(screen.getByText('Abiertos', { selector: 'span' }));
    const trigger = screen.getByRole('button', { name: 'Estado: Abiertos' });
    expect(trigger.textContent).toContain('2');
  });

  it('en selección múltiple acumula opciones', () => {
    render(<MultiHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Canal' }));
    fireEvent.click(screen.getByText('Todos', { selector: 'span' }));
    fireEvent.click(screen.getByText('Abiertos', { selector: 'span' }));
    expect(screen.getByRole('button', { name: 'Canal: 2 seleccionados' })).toBeTruthy();
  });
});

describe('ToolbarSearch', () => {
  it('se expande, filtra y Escape borra y contrae', () => {
    render(<SearchHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Buscar alertas' }));
    const input = screen.getByRole('searchbox', { name: 'Buscar alertas' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'maría' } });
    expect(input.value).toBe('maría');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Buscar alertas' })).toBeTruthy();
  });
});
