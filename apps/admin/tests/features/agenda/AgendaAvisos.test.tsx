import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgendaItem, ListaUrgenciasItem } from '@/domain/models/Cita';

const { useAgendaMock, useListaUrgenciasMock, useCambiarEstadoMock, mutateAsyncMock, toastMock, sideSpy } =
  vi.hoisted(() => ({
    useAgendaMock: vi.fn(),
    useListaUrgenciasMock: vi.fn(),
    useCambiarEstadoMock: vi.fn(),
    mutateAsyncMock: vi.fn(),
    toastMock: vi.fn(),
    sideSpy: vi.fn(),
  }));

vi.mock('@/features/agenda/api', () => ({
  useAgenda: useAgendaMock,
  useListaUrgencias: useListaUrgenciasMock,
  useCambiarEstadoCita: useCambiarEstadoMock,
}));

// Drawer mínimo: renderiza su contenido solo cuando `open` (el real usa <dialog>/showModal, que jsdom no soporta).
vi.mock('@yewdiel21/motion-kit/react', async () => {
  const React = await import('react');
  const Ctx = React.createContext<(open: boolean) => void>(() => {});
  const Drawer = {
    Root: ({
      open,
      side,
      onOpenChange,
      children,
    }: {
      open?: boolean;
      side?: string;
      onOpenChange?: (o: boolean) => void;
      children?: ReactNode;
    }) => {
      sideSpy(side);
      return open ? (
        <Ctx.Provider value={(o) => onOpenChange?.(o)}>
          <div role="dialog" data-side={side}>
            {children}
          </div>
        </Ctx.Provider>
      ) : null;
    },
    Content: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Header: ({ children }: { children?: ReactNode }) => <header>{children}</header>,
    Title: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
    Description: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
    Body: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Close: ({ label }: { label?: string }) => {
      const set = React.useContext(Ctx);
      return (
        <button type="button" onClick={() => set(false)}>
          {label}
        </button>
      );
    },
  };
  return { toast: toastMock, Drawer };
});

import { AgendaAvisos } from '@/features/agenda/AgendaAvisos';

function tomorrowAt(hour: number): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, hour, 0).toISOString();
}

function cita(id: string, hour: number, extra: Partial<AgendaItem> = {}): AgendaItem {
  return {
    citaId: id,
    programadaEn: tomorrowAt(hour),
    estado: 'agendada',
    prioridad: null,
    areaId: 1,
    areaClave: 'psicologia',
    recomendadaPor: null,
    reagendadaDe: null,
    origen: 'regular',
    personaId: `p-${id}`,
    nombreCompleto: `Persona ${id}`,
    celular: '6671234567',
    ...extra,
  };
}

function urgencia(id: string, extra: Partial<ListaUrgenciasItem> = {}): ListaUrgenciasItem {
  return {
    personaId: `p-${id}`,
    fichaId: `f-${id}`,
    folio: `SM-${id}`,
    nombreCompleto: `Urgente ${id}`,
    celular: '6679876543',
    areaUltimaPrioridad: 'trabajo_social',
    fechaUltimaPrioridad: '2026-11-20',
    ...extra,
  };
}

function queryOk<T>(data: T) {
  return { data, isPending: false, isError: false, refetch: vi.fn() };
}
const PENDING = { data: undefined, isPending: true, isError: false, refetch: vi.fn() };

function ui(onOpenCita = vi.fn(), areaId?: number | null) {
  return (
    <MemoryRouter>
      <AgendaAvisos areaId={areaId} onOpenCita={onOpenCita} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mutateAsyncMock.mockReset().mockResolvedValue({ citaId: 'x', estado: 'confirmada', confirmadaEn: 'now' });
  useCambiarEstadoMock.mockReturnValue({ mutateAsync: mutateAsyncMock });
  toastMock.mockReset();
  sideSpy.mockReset();
  useAgendaMock.mockReturnValue(queryOk([]));
  useListaUrgenciasMock.mockReturnValue(queryOk([]));
});
afterEach(cleanup);

describe('AgendaAvisos · barra', () => {
  it('muestra una píldora por aviso con contador y etiqueta corta', () => {
    useAgendaMock.mockReturnValue(queryOk([cita('a', 9)]));
    useListaUrgenciasMock.mockReturnValue(queryOk([urgencia('1'), urgencia('2'), urgencia('3')]));
    render(ui());

    expect(screen.getByRole('button', { name: '1 por confirmar mañana' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '3 en lista de urgencias' })).toBeTruthy();
    // La explicación larga vive dentro de la hoja, no en la página.
    expect(screen.queryByText(/pueden ocupar un espacio/)).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('oculta la píldora cuyo contador es 0', () => {
    useAgendaMock.mockReturnValue(queryOk([]));
    useListaUrgenciasMock.mockReturnValue(queryOk([urgencia('1')]));
    render(ui());

    expect(screen.queryByRole('button', { name: /por confirmar mañana/ })).toBeNull();
    expect(screen.getByRole('button', { name: '1 en lista de urgencias' })).toBeTruthy();
  });

  it('sin pendientes deja solo un texto discreto', () => {
    render(ui());
    expect(screen.getByText('Sin pendientes')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('mientras carga no ocupa espacio ni muestra «Sin pendientes»', () => {
    useAgendaMock.mockReturnValue(PENDING);
    useListaUrgenciasMock.mockReturnValue(PENDING);
    const { container } = render(ui());
    expect(container.firstChild).toBeNull();
  });

  it('si falla una consulta ofrece reintentar sin romper la otra píldora', () => {
    const refetch = vi.fn();
    useAgendaMock.mockReturnValue({ data: undefined, isPending: false, isError: true, refetch });
    useListaUrgenciasMock.mockReturnValue(queryOk([urgencia('1')]));
    render(ui());

    expect(screen.getByRole('button', { name: '1 en lista de urgencias' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(refetch).toHaveBeenCalled();
  });

  it('pasa el área a ambas consultas', () => {
    render(ui(vi.fn(), 4));
    expect(useAgendaMock.mock.calls[0][0].areaId).toBe(4);
    expect(useListaUrgenciasMock).toHaveBeenCalledWith(4);
  });

  it('el contador salta solo cuando cambia, no en el primer render', () => {
    useAgendaMock.mockReturnValue(queryOk([cita('a', 9)]));
    const { rerender } = render(ui());
    const pill = () => screen.getByRole('button', { name: /por confirmar mañana/ });
    expect(pill().querySelector('.av-pill__count')?.hasAttribute('data-pop')).toBe(false);

    useAgendaMock.mockReturnValue(queryOk([cita('a', 9), cita('b', 10)]));
    rerender(ui());
    expect(pill().getAttribute('aria-label')).toBe('2 por confirmar mañana');
    expect(pill().querySelector('.av-pill__count')?.hasAttribute('data-pop')).toBe(true);
  });
});

describe('AgendaAvisos · hoja', () => {
  it('«por confirmar» abre la hoja con título, explicación de una línea y las filas', () => {
    useAgendaMock.mockReturnValue(queryOk([cita('b', 15), cita('a', 9)]));
    render(ui());

    fireEvent.click(screen.getByRole('button', { name: '2 por confirmar mañana' }));

    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByRole('heading', { name: 'Por confirmar · mañana' })).toBeTruthy();
    expect(within(sheet).getByText(/llama para confirmar asistencia/)).toBeTruthy();
    const rows = within(sheet).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Persona a');
    expect(within(sheet).getAllByText('Llamar')).toHaveLength(2);
    expect(within(sheet).getAllByText('Confirmar')).toHaveLength(2);
  });

  it('«urgencias» abre la hoja con nombre, folio, área, desde y enlace al expediente', () => {
    useListaUrgenciasMock.mockReturnValue(queryOk([urgencia('1')]));
    render(ui());

    fireEvent.click(screen.getByRole('button', { name: '1 en lista de urgencias' }));

    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByRole('heading', { name: 'Lista de urgencias' })).toBeTruthy();
    expect(within(sheet).getByText(/pueden ocupar un espacio si alguien cancela/)).toBeTruthy();
    expect(within(sheet).getByText('SM-1')).toBeTruthy();
    expect(within(sheet).getByText('Trabajo social')).toBeTruthy();
    expect(within(sheet).getByText(/Desde/)).toBeTruthy();
    expect(within(sheet).getByRole('link', { name: /Abrir expediente SM-1/ }).getAttribute('href')).toBe(
      '/expedientes/f-1',
    );
    expect(within(sheet).getByRole('link', { name: /Llamar a Urgente 1/ }).getAttribute('href')).toBe(
      'tel:6679876543',
    );
  });

  it('usa el panel lateral en escritorio y la hoja inferior en móvil', () => {
    useAgendaMock.mockReturnValue(queryOk([cita('a', 9)]));
    const original = window.matchMedia;
    try {
      render(ui());
      fireEvent.click(screen.getByRole('button', { name: /por confirmar mañana/ }));
      expect(screen.getByRole('dialog').getAttribute('data-side')).toBe('right');
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
      expect(screen.queryByRole('dialog')).toBeNull();

      window.matchMedia = ((query: string) => ({ matches: true, media: query }) as MediaQueryList) as typeof window.matchMedia;
      fireEvent.click(screen.getByRole('button', { name: /por confirmar mañana/ }));
      expect(screen.getByRole('dialog').getAttribute('data-side')).toBe('bottom');
    } finally {
      window.matchMedia = original;
    }
  });

  it('Cerrar oculta la hoja', () => {
    useListaUrgenciasMock.mockReturnValue(queryOk([urgencia('1')]));
    render(ui());
    fireEvent.click(screen.getByRole('button', { name: /en lista de urgencias/ }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('abrir una cita cierra la hoja y la abre en su diálogo anclada a la píldora', () => {
    const onOpenCita = vi.fn();
    const item = cita('a', 9);
    useAgendaMock.mockReturnValue(queryOk([item]));
    render(ui(onOpenCita));

    const pill = screen.getByRole('button', { name: /por confirmar mañana/ });
    fireEvent.click(pill);
    fireEvent.click(screen.getByRole('button', { name: /Abrir cita de Persona a/ }));

    expect(onOpenCita).toHaveBeenCalledWith(item, pill);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('confirmar desde la hoja baja el contador de la píldora al instante y avisa con toast', async () => {
    useAgendaMock.mockReturnValue(queryOk([cita('a', 9), cita('b', 10)]));
    render(ui());

    fireEvent.click(screen.getByRole('button', { name: '2 por confirmar mañana' }));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar cita de Persona a/ }));

    expect(mutateAsyncMock).toHaveBeenCalledWith({ citaId: 'a', estado: 'confirmada' });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.getByRole('button', { name: '1 por confirmar mañana' })).toBeTruthy();
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(expect.stringContaining('confirmada'), { tone: 'success' }),
    );
  });
});
