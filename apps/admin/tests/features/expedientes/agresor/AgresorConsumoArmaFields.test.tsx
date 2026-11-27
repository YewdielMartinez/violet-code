import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  AgresorConsumoArmaFields,
  type ConsumoArmaValues,
} from '@/features/expedientes/AgresorConsumoArmaFields';

const INITIAL_VALUES: ConsumoArmaValues = {
  drogas: [],
  especificacionDroga: '',
  especificacionArma: '',
  observaciones: '',
};

function Harness({ initial = INITIAL_VALUES }: { initial?: ConsumoArmaValues }) {
  const [values, setValues] = useState<ConsumoArmaValues>(initial);
  return (
    <AgresorConsumoArmaFields
      values={values}
      errores={{}}
      onPatch={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
    />
  );
}

const pressed = (name: RegExp) =>
  screen.getByRole('button', { name }).getAttribute('aria-pressed');

afterEach(() => {
  cleanup();
});

describe('AgresorConsumoArmaFields', () => {
  it('muestra el selector de drogas sin pregunta previa y marcado como opcional', () => {
    render(<Harness />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.getByText(/^Consumo de drogas/i).textContent).toMatch(/opcional/i);
    expect(pressed(/^Marihuana/i)).toBe('false');
  });

  it('permite seleccionar varias drogas y «No consume» es excluyente', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: /^Marihuana/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Cristal/i }));
    expect(pressed(/^Marihuana/i)).toBe('true');
    expect(pressed(/^Cristal/i)).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: /^No consume/i }));
    expect(pressed(/^No consume/i)).toBe('true');
    expect(pressed(/^Marihuana/i)).toBe('false');
    expect(pressed(/^Cristal/i)).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: /^Cocaína/i }));
    expect(pressed(/^No consume/i)).toBe('false');
    expect(pressed(/^Cocaína/i)).toBe('true');
  });

  it('la especificación aparece solo con «Otra» y se limpia al quitarla', () => {
    render(<Harness />);
    const placeholder = /Ej\. sustancia o frecuencia/i;
    expect(screen.queryByPlaceholderText(placeholder)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Otra/i }));
    const input = screen.getByPlaceholderText(placeholder) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Pegamento' } });
    expect(input.value).toBe('Pegamento');

    fireEvent.click(screen.getByRole('button', { name: /^Otra/i }));
    expect(screen.queryByPlaceholderText(placeholder)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Otra/i }));
    expect((screen.getByPlaceholderText(placeholder) as HTMLInputElement).value).toBe('');
  });

  it('permite capturar la especificación del arma u objeto directamente', () => {
    render(<Harness />);

    const input = screen.getByPlaceholderText(/Describe brevemente el objeto o arma/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Cuchillo' } });
    expect(input.value).toBe('Cuchillo');
  });
});
