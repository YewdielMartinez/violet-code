import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WidgetSize } from '@/features/dashboard/layout';
import { widgetDef } from '@/features/dashboard/layout';
import { WidgetShell } from '@/features/dashboard/WidgetShell';
import { estimateBox, WidgetSizeProvider } from '@/features/dashboard/widgets/box';
import { FitList } from '@/features/dashboard/widgets/FitList';
import { describeDelta, KpiTile, type KpiTileProps } from '@/features/dashboard/widgets/KpiTile';
import { Sparkline } from '@/features/dashboard/widgets/Sparkline';
import { WidgetEmpty, WidgetSkeleton } from '@/features/dashboard/widgets/shared';

afterEach(cleanup);

function inSize(size: WidgetSize, node: React.ReactNode) {
  return render(
    <MemoryRouter>
      <WidgetSizeProvider value={size}>{node}</WidgetSizeProvider>
    </MemoryRouter>,
  );
}

const KPI: KpiTileProps = {
  value: 12,
  loading: false,
  error: false,
  delta: { current: 5, previous: 2, goodWhen: 'down', label: 'hoy vs ayer' },
  secondary: '5 nuevas hoy',
  series: { values: [1, 3, 2, 4, 2, 2, 5], label: 'Alertas por día' },
  detailsTitle: 'Estado',
  details: [
    { label: 'Nuevas', value: 5 },
    { label: 'En atención', value: 3 },
    { label: 'Cerradas', value: 9 },
  ],
  meter: { value: 3, max: 12, label: 'En atención' },
};

describe('estimateBox', () => {
  it('crece con las columnas y las filas de la celda', () => {
    expect(estimateBox('m').w).toBeGreaterThan(estimateBox('s').w);
    expect(estimateBox('wide').w).toBeGreaterThan(estimateBox('m').w);
    expect(estimateBox('tall').h).toBeGreaterThan(estimateBox('s').h);
    expect(estimateBox('l').h).toBe(estimateBox('tall').h);
  });
});

describe('KpiTile según el tamaño de la celda', () => {
  it('1×1: cifra y variación, sin minigráfica ni desglose', () => {
    inSize('s', <KpiTile {...KPI} />);
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('hoy vs ayer')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText('Cerradas')).toBeNull();
  });

  it('2×1: agrega la minigráfica junto a la cifra, todavía sin desglose', () => {
    inSize('m', <KpiTile {...KPI} />);
    expect(screen.getByRole('img', { name: /Alertas por día: 1, 3, 2, 4, 2, 2, 5/ })).toBeTruthy();
    expect(screen.queryByText('Cerradas')).toBeNull();
  });

  it('1×2 y 2×2: minigráfica que rellena, barra de proporción y desglose', () => {
    for (const size of ['tall', 'l'] as const) {
      const view = inSize(size, <KpiTile {...KPI} />);
      expect(screen.getByRole('img', { name: /Alertas por día/ })).toBeTruthy();
      expect(screen.getByRole('meter', { name: 'En atención' })).toBeTruthy();
      expect(screen.getByText('Cerradas')).toBeTruthy();
      view.unmount();
    }
  });

  it('4×1: el desglose pasa a una fila junto a la cifra, sin barra de proporción', () => {
    inSize('wide', <KpiTile {...KPI} />);
    expect(screen.getByText('Cerradas')).toBeTruthy();
    expect(screen.queryByRole('meter')).toBeNull();
  });

  it('muestra un esqueleto mientras carga y un error compacto con reintento', () => {
    const view = inSize('s', <KpiTile {...KPI} value={undefined} loading />);
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeTruthy();
    view.unmount();

    const onRetry = vi.fn();
    inSize('s', <KpiTile {...KPI} error onRetry={onRetry} />);
    expect(screen.getByRole('alert').textContent).toContain('No se pudo cargar');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('describeDelta', () => {
  it('distingue favorable, desfavorable y sin cambio según el sentido bueno', () => {
    expect(describeDelta({ current: 5, previous: 2, goodWhen: 'down', label: 'vs ayer' })).toMatchObject({
      diff: 3,
      good: false,
      text: '+3',
    });
    expect(describeDelta({ current: 1, previous: 4, goodWhen: 'down', label: 'vs ayer' })).toMatchObject({
      diff: -3,
      good: true,
      text: '−3',
    });
    expect(describeDelta({ current: 4, previous: 4, goodWhen: 'up', label: 'vs ayer' })).toMatchObject({
      good: null,
      text: 'Sin cambio',
    });
    expect(describeDelta({ current: 6, previous: 2, goodWhen: 'up', label: 'vs ayer' }).spoken).toBe('4 más, vs ayer');
  });
});

describe('Sparkline', () => {
  it('describe sus valores para lectores de pantalla y necesita dos puntos', () => {
    const { container } = render(<Sparkline values={[0, 2, 1]} label="Citas" />);
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe('Citas: 0, 2, 1');
    const empty = render(<Sparkline values={[3]} label="Citas" />);
    expect(empty.container.querySelector('svg')).toBeNull();
  });
});

describe('FitList: más alto ⇒ más filas, más ancho ⇒ más columnas', () => {
  const items = Array.from({ length: 30 }, (_, i) => ({ id: `r${i}` }));
  const count = (size: WidgetSize) => {
    const view = inSize(
      size,
      <FitList label="Filas" items={items} getKey={(r) => r.id} rowHeight={52} renderItem={(r) => <span>{r.id}</span>} />,
    );
    const n = within(screen.getByRole('list', { name: 'Filas' })).getAllByRole('listitem').length;
    view.unmount();
    return n;
  };

  it('una celda baja muestra pocas filas y una alta muchas más', () => {
    expect(count('tall')).toBeGreaterThan(count('s'));
    expect(count('l')).toBeGreaterThan(count('m'));
  });

  it('una celda ancha reparte la lista en varias columnas', () => {
    expect(count('wide')).toBeGreaterThan(count('s'));
    expect(count('xl')).toBeGreaterThan(count('l'));
  });

  it('nunca muestra más elementos de los que hay', () => {
    const few = inSize(
      'xl',
      <FitList label="Pocas" items={items.slice(0, 3)} getKey={(r) => r.id} rowHeight={52} renderItem={(r) => <b>{r.id}</b>} />,
    );
    expect(within(screen.getByRole('list', { name: 'Pocas' })).getAllByRole('listitem')).toHaveLength(3);
    few.unmount();
  });

  it('indica cuántos quedan fuera con un enlace «+N más»', () => {
    inSize(
      's',
      <FitList
        label="Con más"
        items={items}
        getKey={(r) => r.id}
        rowHeight={52}
        more={{ label: 'ver todas', to: '/solicitudes' }}
        renderItem={(r) => <span>{r.id}</span>}
      />,
    );
    const shown = within(screen.getByRole('list', { name: 'Con más' })).getAllByRole('listitem').length;
    expect(screen.getByRole('link').textContent).toContain(`+${items.length - shown} más`);
  });
});

describe('estados vacío, error y carga', () => {
  it('vacío: ícono y dos líneas, con acción opcional', () => {
    inSize(
      'm',
      <WidgetEmpty
        title="Sin alertas pendientes"
        description="Todo al día."
        action={{ label: 'Ver todas', to: '/solicitudes' }}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('Sin alertas pendientes');
    expect(screen.getByText('Todo al día.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver todas' })).toBeTruthy();
  });

  it('error: mensaje fijo de conexión y botón para reintentar', () => {
    const onRetry = vi.fn();
    inSize('m', <WidgetEmpty error title="" onRetry={onRetry} />);
    expect(screen.getByRole('alert').textContent).toContain('Verifica tu conexión');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('esqueletos accesibles por variante', () => {
    for (const variant of ['kpi', 'list', 'chart'] as const) {
      const view = inSize('m', <WidgetSkeleton variant={variant} />);
      expect(screen.getByRole('status', { name: 'Cargando' }).getAttribute('aria-busy')).toBe('true');
      view.unmount();
    }
  });
});

describe('WidgetShell (celda y modo personalizar)', () => {
  const handlers = () => ({ onMove: vi.fn(), onResize: vi.fn(), onHide: vi.fn() });

  it('fuera de edición no muestra controles y marca las columnas/filas de la celda', () => {
    const { container } = render(
      <WidgetShell id="alerts" size="l" index={0} count={3} editing={false} {...handlers()}>
        <p>contenido</p>
      </WidgetShell>,
    );
    const cell = container.querySelector('.vc-cell');
    expect(cell?.getAttribute('data-cs')).toBe('2');
    expect(cell?.getAttribute('data-rs')).toBe('2');
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.getByText('contenido')).toBeTruthy();
  });

  it('en edición ofrece asa de arrastre, flechas, tamaños admitidos y ocultar', () => {
    const h = handlers();
    const { container } = render(
      <WidgetShell id="alerts" size="l" index={1} count={3} editing {...h}>
        <p>contenido</p>
      </WidgetShell>,
    );
    expect(container.querySelector('[data-vc-handle]')).toBeTruthy();
    expect(container.querySelector('.vc-cell')?.getAttribute('data-cell-id')).toBe('alerts');
    // Tres capas: celda, hueco (destino del arrastre) y capa levantada con el widget y sus controles.
    expect(container.querySelector('.vc-cell > .vc-cell__slot')).toBeTruthy();
    expect(container.querySelector('.vc-cell > .vc-cell__lift > .vc-cell__inner')).toBeTruthy();
    expect(container.querySelector('.vc-cell > .vc-cell__lift > .vc-cell__controls')).toBeTruthy();
    expect(container.querySelector('.vc-cell__inner')?.hasAttribute('inert')).toBe(true);

    const select = screen.getByRole('combobox', { name: 'Tamaño de Alertas por atender' }) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual([...widgetDef('alerts').sizes]);
    fireEvent.change(select, { target: { value: 'xl' } });
    expect(h.onResize).toHaveBeenCalledWith('alerts', 'xl');

    fireEvent.click(screen.getByRole('button', { name: 'Mover Alertas por atender antes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mover Alertas por atender después' }));
    expect(h.onMove).toHaveBeenNthCalledWith(1, 'alerts', -1);
    expect(h.onMove).toHaveBeenNthCalledWith(2, 'alerts', 1);

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar Alertas por atender' }));
    expect(h.onHide).toHaveBeenCalledWith('alerts');
  });

  it('deshabilita «antes» en el primero y «después» en el último', () => {
    render(
      <WidgetShell id="kpi_citas" size="s" index={0} count={1} editing {...handlers()}>
        <p>x</p>
      </WidgetShell>,
    );
    expect((screen.getByRole('button', { name: 'Mover Citas de hoy antes' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Mover Citas de hoy después' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
