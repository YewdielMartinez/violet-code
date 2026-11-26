import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  AgresorConsumoArmaFields,
  type ConsumoArmaValues,
} from '../AgresorConsumoArmaFields';

const INITIAL_VALUES: ConsumoArmaValues = {
  tieneConsumoDroga: null,
  drogas: [],
  especificacionDroga: '',
  utilizoArmaUObjeto: null,
  tipoArma: null,
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

afterEach(() => {
  cleanup();
});

describe('AgresorConsumoArmaFields', () => {
  it('permite seleccionar drogas en chips y limpia al cambiar consumo a No', () => {
    render(<Harness />);

    const consumoGroup = screen.getByRole('radiogroup', {
      name: /¿Presenta consumo de drogas\?/i,
    });
    fireEvent.click(within(consumoGroup).getByLabelText('Sí'));

    const marihuanaChip = screen.getByRole('button', { name: /Marihuana/i });
    fireEvent.click(marihuanaChip);
    expect(marihuanaChip.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(within(consumoGroup).getByLabelText('No'));
    fireEvent.click(within(consumoGroup).getByLabelText('Sí'));

    expect(screen.getByRole('button', { name: /Marihuana/i }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('permite elegir tipo de arma cuando utilizó arma y limpia al cambiar a No se sabe', () => {
    render(<Harness />);

    const armaGroup = screen.getByRole('radiogroup', {
      name: /¿Utilizó arma u objeto en la agresión\?/i,
    });
    fireEvent.click(within(armaGroup).getByLabelText('Sí'));

    const tipoArmaGroup = screen.getByRole('radiogroup', {
      name: /Tipo de arma u objeto/i,
    });
    const armaBlancaRadio = within(tipoArmaGroup).getByLabelText('Arma blanca') as HTMLInputElement;
    fireEvent.click(armaBlancaRadio);
    expect(armaBlancaRadio.checked).toBe(true);

    fireEvent.click(within(armaGroup).getByLabelText('No se sabe'));
    fireEvent.click(within(armaGroup).getByLabelText('Sí'));

    const sinEspecificar = within(
      screen.getByRole('radiogroup', { name: /Tipo de arma u objeto/i }),
    ).getByLabelText('Sin especificar') as HTMLInputElement;
    expect(sinEspecificar.checked).toBe(true);
  });
});
