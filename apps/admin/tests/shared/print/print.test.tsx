import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';

const { toastMock, useAuthMock } = vi.hoisted(() => ({ toastMock: vi.fn(), useAuthMock: vi.fn() }));

vi.mock('@yewdiel21/motion-kit/react', () => ({ toast: toastMock }));
vi.mock('@/shared/auth/useAuth', () => ({ useAuth: useAuthMock }));

import { APP_NAME } from '@/app/brand';
import type { ExportColumn } from '@/shared/export';
import {
  PRINT_ROOT_ID,
  buildPrintRoot,
  chartFromContainer,
  fechaGeneracion,
  isPrintRootMounted,
  printReport,
  serializeSvg,
  usePrintable,
  type PrintReportOptions,
} from '@/shared/print';

interface Fila {
  area: string;
  total: number | null;
}

const COLUMNS: ExportColumn<Fila>[] = [
  { key: 'area', header: 'Área', value: (f) => f.area },
  { key: 'total', header: 'Atenciones', value: (f) => f.total },
];

const ROWS: Fila[] = [
  { area: 'Psicología', total: 12 },
  { area: 'Jurídico', total: 1234 },
  { area: 'Total', total: 1246 },
];

const NOW = new Date('2026-03-15T20:05:00Z'); // 13:05 en Mazatlán (UTC−7)

function opciones(over: Partial<PrintReportOptions<Fila>> = {}): PrintReportOptions<Fila> {
  return {
    title: 'Reporte de atenciones',
    subtitle: 'Marzo 2026 · Todas las áreas',
    filtros: [
      { label: 'Periodo', value: 'Marzo 2026' },
      { label: 'Área', value: 'Todas las áreas' },
    ],
    kpis: [{ label: 'Atenciones', value: 1246, nota: '+5 % vs. periodo anterior' }],
    columns: COLUMNS,
    rows: ROWS,
    usuarioRol: 'Psicología',
    nota: 'Documento sin datos personales',
    isTotal: (f) => f.area === 'Total',
    now: NOW,
    ...over,
  };
}

/** jsdom no carga imágenes: `complete` se fuerza para que la espera de logotipos no dependa de la red. */
function imagenesCargadas(cargadas: boolean) {
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(cargadas);
}

beforeEach(() => {
  imagenesCargadas(true);
  useAuthMock.mockReturnValue({ status: 'authenticated', user: { role: 'psicologia' } });
});

afterEach(() => {
  cleanup();
  document.getElementById(PRINT_ROOT_ID)?.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  toastMock.mockReset();
});

describe('buildPrintRoot', () => {
  it('arma encabezado institucional, filtros, fecha y rol', () => {
    const root = buildPrintRoot(opciones());
    const text = root.textContent ?? '';
    expect(root.id).toBe(PRINT_ROOT_ID);
    expect(root.querySelector('.vcp-head .vcp-brand')?.textContent).toBe(APP_NAME);
    expect(root.querySelector('.vcp-head .vcp-inst')?.textContent).toBe('Secretaría de las Mujeres · Ahome');
    expect(root.querySelector('h1')?.textContent).toBe('Reporte de atenciones');
    expect(root.querySelector('.vcp-sub')?.textContent).toBe('Marzo 2026 · Todas las áreas');
    expect(text).toContain('Periodo:');
    expect(text).toContain('Marzo 2026');
    expect(text).toContain('Área:');
    expect(text).toContain('Generado:');
    expect(text).toContain(fechaGeneracion(NOW));
    expect(text).toContain('Usuario (rol):');
    expect(text).toContain('Psicología');
  });

  it('formatea la fecha en la zona horaria de Mazatlán', () => {
    expect(fechaGeneracion(NOW)).toMatch(/13:05|1:05/);
  });

  it('la tabla lleva los encabezados de la exportación, filas, cifras a la derecha y el total resaltado', () => {
    const root = buildPrintRoot(opciones());
    const headers = [...root.querySelectorAll('thead th')].map((th) => th.textContent);
    expect(headers).toEqual(['Área', 'Atenciones']);
    const rows = [...root.querySelectorAll('tbody tr')];
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toBe('Psicología12');
    expect(rows[1].querySelectorAll('td')[1].textContent).toBe('1,234');
    expect(rows[1].querySelectorAll('td')[1].classList.contains('vcp-num')).toBe(true);
    expect(rows[1].querySelectorAll('td')[0].classList.contains('vcp-num')).toBe(false);
    expect(root.querySelector('thead th:last-child')?.classList.contains('vcp-num')).toBe(true);
    expect(rows[2].classList.contains('vcp-total')).toBe(true);
  });

  it('incluye indicadores, nota al pie y nombre del sistema', () => {
    const root = buildPrintRoot(opciones());
    expect(root.querySelector('.vcp-kpi dt')?.textContent).toBe('Atenciones');
    expect(root.querySelector('.vcp-kpi dd')?.textContent).toBe('1,246');
    expect(root.querySelector('.vcp-kpi p')?.textContent).toBe('+5 % vs. periodo anterior');
    const footer = root.querySelector('.vcp-footer')?.textContent ?? '';
    expect(footer).toContain(`${APP_NAME} · Secretaría de las Mujeres · Ahome`);
    expect(footer).toContain('Documento sin datos personales');
    expect(footer).toContain(`Generado: ${fechaGeneracion(NOW)}`);
  });

  it('el encabezado lleva el isotipo a la izquierda y el logotipo de Ahome a la derecha, con URL absoluta', () => {
    const root = buildPrintRoot(opciones());
    const [izq, der] = [...root.querySelectorAll<HTMLImageElement>('.vcp-head img')];
    expect(izq.className).toBe('vcp-logo-app');
    expect(izq.src).toBe(new URL('/logos/app-icon.svg', window.location.origin).href);
    expect(der.className).toBe('vcp-logo-ahome');
    expect(der.src).toBe(new URL('/logo-ahome.png', window.location.origin).href);
    expect(der.alt).toBe('Municipio de Ahome');
    expect(root.querySelector<HTMLImageElement>('.vcp-footer img')?.src).toBe(izq.src);
  });

  it('usa la paleta salmverse y las tipografías de la app, con colores exactos al imprimir', () => {
    const css = buildPrintRoot(opciones()).querySelector('style')?.textContent ?? '';
    expect(css).toContain('#850e35');
    expect(css).toContain('#ffd8e0');
    expect(css).toContain('#fbf7f7');
    expect(css).toContain('"DM Sans"');
    expect(css).toContain('"Geist Mono"');
    expect(css).toContain('print-color-adjust: exact');
  });

  it('muestra en monoespaciada las columnas indicadas', () => {
    const root = buildPrintRoot(opciones({ monoKeys: ['area'] }));
    expect(root.querySelector('tbody td')?.classList.contains('vcp-mono')).toBe(true);
  });

  it('trae el CSS de página: tamaño y margen, encabezado repetido, filas sin corte y paginación', () => {
    const css = buildPrintRoot(opciones()).querySelector('style')?.textContent ?? '';
    expect(css).toContain('@page { size: auto; margin: 16mm;');
    expect(css).toContain('counter(page)');
    expect(css).toContain('display: table-header-group');
    expect(css).toContain('break-inside: avoid');
    expect(css).toContain(`body > *:not(#${PRINT_ROOT_ID}) { display: none !important; }`);
    expect(css).toContain('color-scheme: light');
    expect(css).toMatch(/nth-child\(even\)/);
  });

  it('no interpreta HTML en los textos (todo entra como texto)', () => {
    const root = buildPrintRoot(opciones({ title: '<img src=x onerror=alert(1)>', rows: [{ area: '<b>x</b>', total: 1 }] }));
    expect(root.querySelector('img[src="x"], .vcp-title img')).toBeNull();
    expect(root.querySelector('tbody b')).toBeNull();
    expect(root.querySelector('tbody td')?.textContent).toBe('<b>x</b>');
  });

  it('incluye la gráfica SVG y quita scripts y manejadores', () => {
    const sucio =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="x()"><script>alert(1)</script><rect onclick="x()" width="4" height="4"/></svg>';
    const root = buildPrintRoot(opciones({ chartSvg: sucio }));
    const svg = root.querySelector('.vcp-chart svg');
    expect(svg).not.toBeNull();
    expect(svg?.querySelector('script')).toBeNull();
    expect(svg?.hasAttribute('onload')).toBe(false);
    expect(svg?.querySelector('rect')?.hasAttribute('onclick')).toBe(false);
  });

  it('dibuja barras de respaldo si no hay SVG y omite gráficas vacías', () => {
    const root = buildPrintRoot(
      opciones({
        charts: [
          { title: 'Por área', bars: [{ label: 'Psicología', value: 12 }] },
          { title: 'Vacía' },
        ],
      }),
    );
    expect(root.querySelectorAll('.vcp-chart')).toHaveLength(1);
    expect(root.querySelector('.vcp-chart figcaption')?.textContent).toBe('Por área');
    expect(root.querySelector('.vcp-bars__value')?.textContent).toBe('12');
  });

  it('sin gráficas ni indicadores no genera esas secciones', () => {
    const root = buildPrintRoot(opciones({ kpis: undefined }));
    expect(root.querySelector('.vcp-charts')).toBeNull();
    expect(root.querySelector('.vcp-kpis')).toBeNull();
  });
});

describe('printReport', () => {
  it('monta el documento, llama a window.print y lo retira en afterprint', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    expect(await printReport(opciones())).toBe(true);
    expect(print).toHaveBeenCalledTimes(1);
    expect(document.getElementById(PRINT_ROOT_ID)).not.toBeNull();
    expect(document.body.querySelectorAll(`#${PRINT_ROOT_ID}`)).toHaveLength(1);
    window.dispatchEvent(new Event('afterprint'));
    expect(document.getElementById(PRINT_ROOT_ID)).toBeNull();
  });

  it('no imprime si no hay filas', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    expect(await printReport(opciones({ rows: [] }))).toBe(false);
    expect(print).not.toHaveBeenCalled();
    expect(document.getElementById(PRINT_ROOT_ID)).toBeNull();
  });

  it('reemplaza un documento previo en vez de duplicarlo', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => {});
    await printReport(opciones());
    await printReport(opciones({ title: 'Otro' }));
    expect(document.body.querySelectorAll(`#${PRINT_ROOT_ID}`)).toHaveLength(1);
    expect(document.querySelector(`#${PRINT_ROOT_ID} h1`)?.textContent).toBe('Otro');
  });

  it('retira el documento si window.print falla', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => {
      throw new Error('boom');
    });
    await expect(printReport(opciones())).rejects.toThrow('boom');
    expect(isPrintRootMounted()).toBe(false);
  });

  it('espera a que carguen los logotipos antes de imprimir', async () => {
    imagenesCargadas(false);
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const promesa = printReport(opciones());
    await Promise.resolve();
    await Promise.resolve();
    expect(print).not.toHaveBeenCalled();
    document.querySelectorAll(`#${PRINT_ROOT_ID} img`).forEach((img) => img.dispatchEvent(new Event('load')));
    await promesa;
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('imprime igual si las imágenes tardan demasiado', async () => {
    imagenesCargadas(false);
    vi.useFakeTimers();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const promesa = printReport(opciones());
    await vi.advanceTimersByTimeAsync(3100);
    await promesa;
    expect(print).toHaveBeenCalledTimes(1);
  });
});

describe('serializeSvg / chartFromContainer', () => {
  function chartDom(): HTMLElement {
    const host = document.createElement('div');
    host.innerHTML =
      '<div class="mk-chart"><svg data-mk-chart-svg viewBox="0 0 100 50" width="300" height="150" role="img">' +
      '<g data-mk-part="grid"><line x1="0" x2="100" y1="10" y2="10"/></g>' +
      '<text x="1" y="1">12</text><rect data-mk-part="bar" width="5" height="5"/>' +
      '<g data-mk-part="guide"><line/></g></svg>' +
      '<ul data-mk-chart-legend><li><span data-mk-chart-swatch style="background:rgb(1, 2, 3)"></span>Primera vez</li></ul></div>';
    document.body.append(host);
    return host;
  }

  it('serializa el SVG sin elementos interactivos y con texto oscuro', () => {
    const host = chartDom();
    const out = serializeSvg(host.querySelector('svg'));
    expect(out).not.toBeNull();
    expect(out).toContain('viewBox="0 0 100 50"');
    expect(out).not.toContain('data-mk-part="guide"');
    expect(out).not.toContain('role=');
    expect(out).toMatch(/<text[^>]*fill: ?(#333333|rgb\(51, 51, 51\))/);
    host.remove();
  });

  it('captura SVG y leyenda de un contenedor; sin SVG usa las barras de respaldo', () => {
    const host = chartDom();
    const chart = chartFromContainer(host, 'Atenciones');
    expect(chart?.svg).toContain('<svg');
    expect(chart?.legend?.[0].label).toBe('Primera vez');
    host.remove();

    const vacio = document.createElement('div');
    expect(chartFromContainer(vacio, 'X')).toBeNull();
    expect(chartFromContainer(vacio, 'X', [{ label: 'a', value: 1 }])?.bars).toHaveLength(1);
    expect(chartFromContainer(null, 'X')).toBeNull();
  });
});

describe('usePrintable', () => {
  function Probe({ build, onReady }: { build: () => PrintReportOptions<Fila> | null; onReady: (fn: () => boolean) => void }) {
    onReady(usePrintable(build));
    return null;
  }

  it('avisa con un toast, completa el rol de la sesión e imprime con window.print', async () => {
    vi.useFakeTimers();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    let imprimir: () => boolean = () => false;
    render(<Probe build={() => opciones({ usuarioRol: undefined })} onReady={(fn) => (imprimir = fn)} />);
    let ok = false;
    act(() => {
      ok = imprimir();
    });
    expect(ok).toBe(true);
    expect(toastMock).toHaveBeenCalledWith(expect.stringContaining('Guardar como PDF'), { tone: 'success' });
    expect(print).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(print).toHaveBeenCalledTimes(1);
    expect(document.querySelector(`#${PRINT_ROOT_ID}`)?.textContent).toContain('Psicología');
  });

  it('no hace nada si no hay datos', async () => {
    vi.useFakeTimers();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    let imprimir: () => boolean = () => true;
    render(<Probe build={() => null} onReady={(fn) => (imprimir = fn)} />);
    expect(imprimir()).toBe(false);
    await vi.advanceTimersByTimeAsync(300);
    expect(print).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('avisa si no se puede armar el documento', () => {
    let imprimir: () => boolean = () => true;
    render(
      <Probe
        build={() => {
          throw new Error('pii');
        }}
        onReady={(fn) => (imprimir = fn)}
      />,
    );
    expect(imprimir()).toBe(false);
    expect(toastMock).toHaveBeenCalledWith(expect.stringContaining('No se pudo'), { tone: 'error' });
  });

  it('Ctrl/Cmd+P: en beforeprint monta el mismo documento y en afterprint lo retira', () => {
    render(<Probe build={() => opciones()} onReady={() => {}} />);
    expect(isPrintRootMounted()).toBe(false);
    window.dispatchEvent(new Event('beforeprint'));
    expect(isPrintRootMounted()).toBe(true);
    expect(document.querySelector(`#${PRINT_ROOT_ID} h1`)?.textContent).toBe('Reporte de atenciones');
    window.dispatchEvent(new Event('afterprint'));
    expect(isPrintRootMounted()).toBe(false);
  });

  it('beforeprint sin datos deja imprimir la pantalla normal', () => {
    render(<Probe build={() => null} onReady={() => {}} />);
    window.dispatchEvent(new Event('beforeprint'));
    expect(isPrintRootMounted()).toBe(false);
  });
});
