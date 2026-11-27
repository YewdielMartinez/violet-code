import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChartPanel, HBARS_LIMITE, HBars } from '@/features/informes/ChartPanel';

const puntos = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `Tipo ${i + 1}`, value: 100 - i }));

describe('HBars', () => {
  afterEach(cleanup);

  it('con pocas categorías las muestra todas y sin «Ver todo»', () => {
    render(<HBars puntos={puntos(4)} label="Tipos" />);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: /Ver todo/ })).toBeNull();
  });

  it('con muchas categorías muestra las primeras y «Ver todo» las despliega (y «Ver menos» las repliega)', () => {
    render(<HBars puntos={puntos(23)} label="Tipos" />);
    expect(screen.getAllByRole('listitem')).toHaveLength(HBARS_LIMITE);
    const mas = screen.getByRole('button', { name: 'Ver todo (23)' });
    expect(mas.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(mas);
    expect(screen.getAllByRole('listitem')).toHaveLength(23);
    fireEvent.click(screen.getByRole('button', { name: 'Ver menos' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(HBARS_LIMITE);
  });

  it('formatea el valor en es-MX y deja el texto completo en title (con su parte del total)', () => {
    render(<HBars puntos={[{ label: 'Psicología', value: 1500 }, { label: 'Jurídico', value: 500 }]} label="Áreas" />);
    expect(screen.getByText('1,500')).toBeTruthy();
    expect(screen.getByRole('listitem', { name: /Psicología/ }).getAttribute('title')).toBe('Psicología: 1,500 (75 %)');
  });

  it('sin datos muestra el estado vacío', () => {
    render(<HBars puntos={[]} label="Áreas" />);
    expect(screen.getByText('Sin datos en el periodo')).toBeTruthy();
  });
});

describe('ChartPanel', () => {
  afterEach(cleanup);

  const data = { columns: ['Mes', 'Atenciones'], rows: [['Enero', 1200]] as (string | number)[][] };

  it('muestra el insight bajo el título y alterna a la tabla «Ver datos» en su propia región', () => {
    render(
      <ChartPanel title="Atenciones por mes" insight="▲ 12 % vs. mes anterior" summary="resumen" data={data}>
        <div>grafica</div>
      </ChartPanel>,
    );
    expect(screen.getByText('▲ 12 % vs. mes anterior')).toBeTruthy();
    expect(screen.getByText('grafica')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Ver datos' }));
    expect(screen.getByRole('region', { name: 'Datos de Atenciones por mes' })).toBeTruthy();
    expect(screen.getByText('1,200')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver gráfica' }));
    expect(screen.getByText('grafica')).toBeTruthy();
  });

  it('sin insight no deja un párrafo vacío', () => {
    const { container } = render(
      <ChartPanel title="X" summary="r" data={data}>
        <div />
      </ChartPanel>,
    );
    expect(container.querySelector('.est-panel__insight')).toBeNull();
  });
});
