import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { StaffRole } from '@/domain/models/Auth';
import {
  availableWidgets,
  defaultLayout,
  KPI_IDS,
  moveItemBy,
  reorderVisible,
  resetLayout,
  resolveLayout,
  serializeLayout,
  setItemSize,
  setItemVisible,
  SIZE_SPECS,
  updateLayout,
  useDashboardLayout,
  validSize,
  visibleItems,
  widgetDef,
  WIDGETS,
  type LayoutItem,
} from '@/features/dashboard/layout';

const ROLES: StaffRole[] = ['titular', 'subdireccion', 'trabajo_social', 'psicologia', 'juridico', 'recepcion', 'umeca'];
const ids = (items: readonly LayoutItem[]) => items.map((i) => i.id);

describe('dashboard widgets by role', () => {
  it('reserva security exclusivamente para titular y subdirección', () => {
    expect(availableWidgets('titular').some((w) => w.id === 'security')).toBe(true);
    expect(availableWidgets('subdireccion').some((w) => w.id === 'security')).toBe(true);
    expect(availableWidgets('trabajo_social').some((w) => w.id === 'security')).toBe(false);
    expect(availableWidgets('psicologia').some((w) => w.id === 'security')).toBe(false);
    expect(availableWidgets('recepcion').some((w) => w.id === 'security')).toBe(false);
  });

  it('oculta alertas, expedientes, urgentes y tendencias a recepción', () => {
    expect(availableWidgets('recepcion').map((w) => w.id)).toEqual(['kpi_citas', 'agenda', 'directory']);
  });

  it('UMECA no tiene widgets de personal', () => {
    expect(availableWidgets('umeca')).toEqual([]);
  });

  it('cada widget admite su tamaño por defecto', () => {
    for (const w of WIDGETS) expect(w.sizes).toContain(w.defaultSize);
  });

  it('el KPI de urgentes se llama «Casos urgentes»', () => {
    expect(widgetDef('kpi_prioritarios').title).toBe('Casos urgentes');
  });
});

describe('tamaños', () => {
  it('define 1×1, 2×1, 1×2, 2×2 y ancho completo', () => {
    expect(SIZE_SPECS.s).toMatchObject({ cols: 1, rows: 1 });
    expect(SIZE_SPECS.m).toMatchObject({ cols: 2, rows: 1 });
    expect(SIZE_SPECS.tall).toMatchObject({ cols: 1, rows: 2 });
    expect(SIZE_SPECS.l).toMatchObject({ cols: 2, rows: 2 });
    expect(SIZE_SPECS.wide).toMatchObject({ cols: 4, rows: 1 });
    expect(SIZE_SPECS.xl).toMatchObject({ cols: 4, rows: 2 });
  });

  it('validSize cae al tamaño por defecto si el widget no lo admite', () => {
    expect(validSize('kpi_citas', 'xl')).toBe('s');
    expect(validSize('kpi_citas', 'nope')).toBe('s');
    expect(validSize('alerts', 'wide')).toBe('wide');
    expect(validSize('alerts', 's')).toBe('l');
  });
});

describe('defaultLayout (por rol)', () => {
  it.each(ROLES)('%s: cada widget disponible aparece una sola vez y con tamaño válido', (role) => {
    const layout = defaultLayout(role);
    expect(ids(layout).sort()).toEqual(
      availableWidgets(role)
        .map((w) => w.id)
        .sort(),
    );
    for (const item of layout) expect(widgetDef(item.id).sizes).toContain(item.size);
  });

  it.each(ROLES.filter((r) => r !== 'umeca'))('%s: lo visible llena la cuadrícula de 4 columnas', (role) => {
    const area = visibleItems(defaultLayout(role)).reduce(
      (sum, i) => sum + SIZE_SPECS[i.size].cols * SIZE_SPECS[i.size].rows,
      0,
    );
    expect(area % 4).toBe(0);
  });

  it('dirección ve el panorama completo y las áreas de atención su bandeja', () => {
    expect(ids(visibleItems(defaultLayout('titular')))).toEqual([
      ...KPI_IDS,
      'alerts',
      'agenda',
      'trend',
      'cases',
      'security',
    ]);
    const ts = ids(visibleItems(defaultLayout('trabajo_social')));
    expect(ts).toContain('alerts');
    expect(ts).not.toContain('security');
    expect(ts).not.toContain('trend');
  });

  it('psicología no ve alertas y recepción solo citas, directorio y agenda', () => {
    expect(ids(visibleItems(defaultLayout('psicologia')))).not.toContain('alerts');
    expect(ids(visibleItems(defaultLayout('recepcion')))).toEqual(['kpi_citas', 'directory', 'agenda']);
  });
});

describe('resolveLayout (migración y saneamiento)', () => {
  it('sin nada guardado usa el layout por defecto', () => {
    expect(resolveLayout(null, 'titular')).toEqual(defaultLayout('titular'));
    expect(resolveLayout('basura', 'titular')).toEqual(defaultLayout('titular'));
  });

  it('migra v2: `kpis` se expande a los 4 KPI, el resto conserva su orden y lo demás queda oculto', () => {
    const layout = resolveLayout(['kpis', 'agenda', 'alerts'], 'titular');
    expect(ids(visibleItems(layout))).toEqual([...KPI_IDS, 'agenda', 'alerts']);
    expect(
      layout
        .filter((i) => !i.visible)
        .map((i) => i.id)
        .sort(),
    ).toEqual(['cases', 'directory', 'security', 'trend']);
    expect(layout.find((i) => i.id === 'alerts')?.size).toBe('l');
  });

  it('migra v2 respetando permisos: a recepción no le aparece lo que no puede ver', () => {
    const layout = resolveLayout(['kpis', 'alerts', 'security', 'agenda'], 'recepcion');
    expect(ids(visibleItems(layout))).toEqual(['kpi_citas', 'agenda']);
    expect(ids(layout)).not.toContain('alerts');
  });

  it('migra v2 vacío: la persona había ocultado todo', () => {
    const layout = resolveLayout([], 'titular');
    expect(visibleItems(layout)).toEqual([]);
    expect(layout).toHaveLength(availableWidgets('titular').length);
  });

  it('migra v2 ignorando ids desconocidos y repetidos', () => {
    const layout = resolveLayout(['x', 'agenda', 'agenda', 3, null], 'titular');
    expect(ids(visibleItems(layout))).toEqual(['agenda']);
  });

  it('v3: descarta ids sin permiso o desconocidos, corrige tamaños y completa lo que falta', () => {
    const stored = {
      v: 3,
      items: [
        { id: 'security', size: 'wide', visible: true },
        { id: 'alerts', size: 's', visible: true },
        { id: 'alerts', size: 'xl', visible: true },
        { id: 'inventado', size: 'm', visible: true },
        { id: 'kpi_citas', size: 'm', visible: false },
      ],
    };
    const layout = resolveLayout(stored, 'trabajo_social');
    expect(ids(layout)).not.toContain('security');
    expect(layout.filter((i) => i.id === 'alerts')).toEqual([{ id: 'alerts', size: 'l', visible: true }]);
    expect(layout.find((i) => i.id === 'kpi_citas')).toEqual({ id: 'kpi_citas', size: 'm', visible: false });
    expect(ids(layout).sort()).toEqual(
      availableWidgets('trabajo_social')
        .map((w) => w.id)
        .sort(),
    );
  });

  it('serializeLayout + resolveLayout es un viaje de ida y vuelta', () => {
    const layout = moveItemBy(setItemSize(defaultLayout('titular'), 'alerts', 'xl'), 'agenda', -1);
    expect(resolveLayout(serializeLayout(layout), 'titular')).toEqual(layout);
  });
});

describe('transformaciones', () => {
  // visibles: kpi×4, alerts, agenda, trend, cases, security · oculto: directory
  const base = defaultLayout('titular');

  it('setItemSize cambia el tamaño y rechaza los no admitidos', () => {
    expect(setItemSize(base, 'alerts', 'xl').find((i) => i.id === 'alerts')?.size).toBe('xl');
    expect(setItemSize(base, 'kpi_citas', 'xl').find((i) => i.id === 'kpi_citas')?.size).toBe('s');
  });

  it('setItemVisible oculta en su lugar y al mostrar lo manda al final', () => {
    const hiddenAlerts = setItemVisible(base, 'alerts', false);
    expect(hiddenAlerts.find((i) => i.id === 'alerts')?.visible).toBe(false);
    expect(ids(hiddenAlerts)).toEqual(ids(base));
    const shown = setItemVisible(base, 'directory', true);
    expect(ids(shown)[ids(shown).length - 1]).toBe('directory');
    const shownVisible = visibleItems(shown);
    expect(shownVisible[shownVisible.length - 1].id).toBe('directory');
  });

  it('moveItemBy mueve entre visibles saltando los ocultos y respeta los extremos', () => {
    const list = setItemVisible(base, 'trend', false);
    const before = ids(visibleItems(list));
    const moved = ids(visibleItems(moveItemBy(list, 'cases', -1)));
    expect(moved.indexOf('cases')).toBe(before.indexOf('cases') - 1);
    expect(moved.indexOf('agenda')).toBe(before.indexOf('agenda') + 1);
    expect(ids(moveItemBy(base, 'kpi_alerts', -1))).toEqual(ids(base));
    expect(ids(moveItemBy(base, 'security', 1))).toEqual(ids(base));
  });

  it('reorderVisible lleva el widget a la posición indicada y deja los ocultos donde estaban', () => {
    const list = setItemVisible(base, 'agenda', false);
    const reordered = reorderVisible(list, 'security', 0);
    expect(visibleItems(reordered)[0].id).toBe('security');
    expect(reordered.findIndex((i) => i.id === 'agenda')).toBe(list.findIndex((i) => i.id === 'agenda'));
    expect(ids(reordered).sort()).toEqual(ids(list).sort());
  });

  it('reorderVisible limita la posición a los extremos y no cambia nada si el widget no es visible', () => {
    const last = visibleItems(reorderVisible(base, 'kpi_alerts', 99));
    expect(last[last.length - 1].id).toBe('kpi_alerts');
    expect(visibleItems(reorderVisible(base, 'security', -5))[0].id).toBe('security');
    expect(reorderVisible(base, 'directory', 0)).toEqual(base);
  });

  it('no muta la lista original', () => {
    const copy = structuredClone(base);
    setItemSize(base, 'alerts', 'xl');
    setItemVisible(base, 'alerts', false);
    reorderVisible(base, 'security', 0);
    expect(base).toEqual(copy);
  });
});

describe('persistencia por usuario', () => {
  beforeEach(() => localStorage.clear());

  it('guarda en v3, notifica y restablece (borrando también v2)', () => {
    const user = 'u-persist';
    const { result } = renderHook(() => useDashboardLayout(user, 'titular'));
    expect(result.current).toEqual(defaultLayout('titular'));

    act(() => updateLayout(user, 'titular', (items) => setItemSize(items, 'alerts', 'xl')));
    expect(result.current.find((i) => i.id === 'alerts')?.size).toBe('xl');
    const raw = JSON.parse(localStorage.getItem(`vc-dashboard:v3:${user}`) ?? 'null');
    expect(raw.v).toBe(3);
    expect(raw.items.find((i: { id: string }) => i.id === 'alerts').size).toBe('xl');

    localStorage.setItem(`vc-dashboard:v2:${user}`, '["agenda"]');
    act(() => resetLayout(user));
    expect(result.current).toEqual(defaultLayout('titular'));
    expect(localStorage.getItem(`vc-dashboard:v3:${user}`)).toBeNull();
    expect(localStorage.getItem(`vc-dashboard:v2:${user}`)).toBeNull();
  });

  it('lee y migra la preferencia v2 existente', () => {
    const user = 'u-legacy';
    localStorage.setItem(`vc-dashboard:v2:${user}`, JSON.stringify(['kpis', 'cases']));
    const { result } = renderHook(() => useDashboardLayout(user, 'psicologia'));
    expect(ids(visibleItems(result.current))).toEqual([...KPI_IDS, 'cases']);
  });

  it('cada usuario tiene su propia composición', () => {
    act(() => updateLayout('u-a', 'titular', (items) => setItemVisible(items, 'security', false)));
    const a = renderHook(() => useDashboardLayout('u-a', 'titular')).result.current;
    const b = renderHook(() => useDashboardLayout('u-b', 'titular')).result.current;
    expect(a.find((i) => i.id === 'security')?.visible).toBe(false);
    expect(b.find((i) => i.id === 'security')?.visible).toBe(true);
  });
});
