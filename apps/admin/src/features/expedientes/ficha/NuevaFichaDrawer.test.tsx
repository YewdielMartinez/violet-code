import { createContext, StrictMode, useContext, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { createCompleteMock, getCatalogosMock, listAsentamientosMock, toastMock } = vi.hoisted(() => ({
  createCompleteMock: vi.fn(),
  getCatalogosMock: vi.fn(),
  listAsentamientosMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('gsap', () => ({ gsap: { fromTo: vi.fn() } }));
vi.mock('@/infrastructure/supabase/adapters/SupabaseExpedienteRepository', () => ({
  supabaseExpedienteRepository: { list: vi.fn(), verifyByCurp: vi.fn(), registerConsult: vi.fn() },
}));
vi.mock('@/infrastructure/supabase/adapters/SupabaseFichaRepository', () => ({
  supabaseFichaRepository: { createComplete: createCompleteMock, getDetail: vi.fn(), archive: vi.fn(), deactivate: vi.fn() },
}));
vi.mock('@/infrastructure/supabase/adapters/SupabaseSepomexRepository', () => ({
  supabaseSepomexRepository: { getCatalogosFicha: getCatalogosMock, listAsentamientos: listAsentamientosMock },
}));

vi.mock('@yewdiel21/motion-kit/react', () => {
  const DrawerCtx = createContext<(open: boolean) => void>(() => {});
  const StepsCtx = createContext(0);
  const StepIdxCtx = createContext(-1);
  const MockStep = ({ children }: { children?: ReactNode }) => (
    <section data-mk-step="" hidden={useContext(StepsCtx) !== useContext(StepIdxCtx)}>{children}</section>
  );

  return {
    Drawer: {
      Root: ({ open, onOpenChange, children }: { open?: boolean; onOpenChange?: (o: boolean) => void; children?: ReactNode }) =>
        open ? <DrawerCtx.Provider value={onOpenChange ?? (() => {})}><div data-testid="drawer-root">{children}</div></DrawerCtx.Provider> : null,
      Content: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
      Header: ({ children }: { children?: ReactNode }) => <header>{children}</header>,
      Title: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
      Description: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
      Body: ({ children }: { children?: ReactNode }) => <div data-mk-part="body">{children}</div>,
      Footer: ({ children }: { children?: ReactNode }) => <footer>{children}</footer>,
      Close: ({ label }: { label?: string }) => {
        const onOpenChange = useContext(DrawerCtx);
        return <button type="button" onClick={() => onOpenChange(false)}>{label ?? 'Cerrar'}</button>;
      },
    },
    Dialog: {
      Root: ({ open, children }: { open?: boolean; children?: ReactNode }) => (open ? <div role="dialog">{children}</div> : null),
      Content: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      Header: ({ children }: { children?: ReactNode }) => <header>{children}</header>,
      Title: ({ children }: { children?: ReactNode }) => <h3>{children}</h3>,
      Body: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      Footer: ({ children }: { children?: ReactNode }) => <footer>{children}</footer>,
      Close: ({ label }: { label?: string }) => <button type="button">{label ?? 'Cerrar'}</button>,
    },
    Stepper: ({ items, value, onChange }: { items: { label: string }[]; value?: number; onChange?: (n: number) => void }) => (
      <nav aria-label="Pasos">
        {items.map((item, i) => (
          <button key={item.label} type="button" aria-current={value === i ? 'step' : undefined} onClick={() => onChange?.(i)}>{item.label}</button>
        ))}
      </nav>
    ),
    Steps: Object.assign(
      ({ index = 0, children }: { index?: number; children?: ReactNode }) => {
        const list = Array.isArray(children) ? children : [children];
        let stepNum = 0;
        return (
          <StepsCtx.Provider value={index}>
            <div>
              {list.map((child, idx) => {
                const isStep = Boolean(child && typeof child === 'object' && 'type' in child && (child as { type?: unknown }).type === MockStep);
                if (!isStep) return <span key={idx}>{child}</span>;
                const val = stepNum++;
                return <StepIdxCtx.Provider key={idx} value={val}>{child}</StepIdxCtx.Provider>;
              })}
            </div>
          </StepsCtx.Provider>
        );
      },
      { Step: MockStep, Counter: () => <span data-mk-counter="">{useContext(StepsCtx) + 1}</span> },
    ),
    LoadingButton: ({ children, type, form, state }: { children?: ReactNode; type?: 'button' | 'submit'; form?: string; state?: string }) => (
      <button type={type ?? 'button'} form={form} data-state={state}>{children}</button>
    ),
    Select: ({ label, value, options = [], onChange }: { label?: string; value?: string; options?: { value: string; label: string }[]; onChange?: (v: string) => void }) => (
      <select aria-label={label} value={value ?? ''} onChange={(e) => onChange?.(e.target.value)}>
        <option value="">Selecciona…</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    ),
    MultiSelect: ({ label, value = [], onChange }: { label?: string; value?: string[]; onChange?: (v: string[]) => void }) => (
      <input data-mk-ms-input="" aria-label={label} value={value.join(',')} onChange={(e) => onChange?.(e.target.value ? e.target.value.split(',') : [])} />
    ),
    GlassSwitch: ({ checked, onChange, children }: { checked?: boolean; onChange?: (v: boolean) => void; children?: ReactNode }) => (
      <label>
        <input data-mk-glass-switch-input="" type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange?.(e.target.checked)} />
        <span>{children}</span>
      </label>
    ),
    RadioGroup: ({ label, value, items = [], onChange }: { label?: string; value?: string; items?: { value: string; label: string }[]; onChange?: (v: string) => void }) => (
      <div role="radiogroup" aria-label={label}>
        {items.map((item) => (
          <label key={item.value}><input type="radio" name={label} checked={value === item.value} onChange={() => onChange?.(item.value)} />{item.label}</label>
        ))}
      </div>
    ),
    toast: toastMock,
  };
});

import { NuevaFichaDrawer } from './NuevaFichaDrawer';

function renderDrawer(props: Partial<Parameters<typeof NuevaFichaDrawer>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onClose = props.onClose ?? vi.fn();
  return {
    onClose,
    ...render(
      <StrictMode>
        <QueryClientProvider client={client}>
          <NuevaFichaDrawer open={props.open ?? true} seed={props.seed ?? null} onClose={onClose} onCreated={props.onCreated} />
        </QueryClientProvider>
      </StrictMode>,
    ),
  };
}

function fillStep0() {
  fireEvent.change(screen.getByLabelText(/CURP \*/i), { target: { value: 'GALA900512MSLNRR01' } });
  fireEvent.change(screen.getByLabelText(/Nombre\(s\) \*/i), { target: { value: 'Laura' } });
  fireEvent.change(screen.getByLabelText(/Apellido paterno \*/i), { target: { value: 'García' } });
  fireEvent.change(screen.getByLabelText(/Servicios solicitados \*/i), { target: { value: '1' } });
  fireEvent.click(screen.getByLabelText(/Aviso de Privacidad/i));
}

beforeEach(() => {
  createCompleteMock.mockReset().mockResolvedValue({ fichaId: 'ficha-99', folio: 'SEM-2026-0099', personaId: 'p-1' });
  getCatalogosMock.mockReset().mockResolvedValue({
    areas: [{ id: 1, clave: 'ts', nombre: 'Trabajo Social' }],
    ocupaciones: [{ id: 2, clave: 'emp', nombre: 'Empleada' }],
    discapacidades: [], gruposEtnicos: [], religiones: [],
    parentescos: [{ id: 3, clave: 'hermana', nombre: 'Hermana' }],
  });
  // Un asentamiento de Ahome: un CP fuera del catálogo entra en modo "solo código postal".
  listAsentamientosMock.mockReset().mockResolvedValue([
    {
      id: 1,
      nombre: 'Centro',
      tipoAsentamiento: 'Colonia',
      codigoPostal: '81200',
      municipio: 'Ahome',
      estado: 'Sinaloa',
      localidad: 'Los Mochis',
    },
  ]);
  toastMock.mockReset();
});

afterEach(() => cleanup());

describe('NuevaFichaDrawer (validación por paso, navegación y cambios sin guardar)', () => {
  it('valida cada paso, enfoca el primer campo inválido y guarda la ficha', async () => {
    const onCreated = vi.fn();
    const { onClose } = renderDrawer({ onCreated });
    await waitFor(() => expect(getCatalogosMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    const curpInput = screen.getByLabelText(/CURP \*/i);
    expect(screen.getByRole('alert').textContent).toMatch(/CURP/i);
    expect(document.activeElement).toBe(curpInput);

    fireEvent.change(curpInput, { target: { value: 'GALA900512MSLNRR01' } });
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    const nombresInput = screen.getByLabelText(/Nombre\(s\) \*/i);
    expect(screen.getByRole('alert').textContent).toMatch(/Nombre\(s\)/i);
    expect(document.activeElement).toBe(nombresInput);

    fillStep0();
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    expect(screen.getByText(/Domicilio de la usuaria/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    expect(screen.getByRole('alert').textContent).toMatch(/asentamiento|código postal/i);

    await waitFor(() => expect(listAsentamientosMock).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(/Código postal/i), { target: { value: '80000' } });
    await screen.findByText(/sin\s+asentamientos en catálogo local/i);
    fireEvent.change(screen.getByLabelText(/Calle \*/i), { target: { value: 'Av. Hidalgo 120' } });
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    expect(screen.getByText(/Estudio socioeconómico y vivienda/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Atrás/i }));
    expect((screen.getByLabelText(/Calle \*/i) as HTMLInputElement).value).toBe('Av. Hidalgo 120');

    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    fireEvent.click(screen.getByRole('button', { name: /Guardar ficha/i }));

    await waitFor(() => expect(createCompleteMock).toHaveBeenCalledTimes(1));
    expect(toastMock).toHaveBeenCalledWith('Expediente SEM-2026-0099 registrado.');
    expect(onCreated).toHaveBeenCalledWith('ficha-99');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('pide confirmación solo si hay cambios sin guardar y notifica errores al guardar', async () => {
    const onCloseClean = vi.fn();
    renderDrawer({ seed: { curp: 'GALA900512MSLNRR01' }, onClose: onCloseClean });
    fireEvent.click(screen.getByRole('button', { name: /Cerrar panel/i }));
    expect(onCloseClean).toHaveBeenCalledTimes(1);
    cleanup();

    createCompleteMock.mockRejectedValueOnce(new Error('DB error'));
    const onCloseDirty = vi.fn();
    renderDrawer({ onClose: onCloseDirty });

    fireEvent.change(screen.getByLabelText(/CURP \*/i), { target: { value: 'GALA900512MSLNRR01' } });
    fireEvent.click(screen.getByRole('button', { name: /Cerrar panel/i }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(onCloseDirty).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Seguir editando/i }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fillStep0();
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    await waitFor(() => expect(listAsentamientosMock).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(/Código postal/i), { target: { value: '80000' } });
    await screen.findByText(/sin\s+asentamientos en catálogo local/i);
    fireEvent.change(screen.getByLabelText(/Calle \*/i), { target: { value: 'Calle 10' } });
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    fireEvent.click(screen.getByRole('button', { name: /Guardar ficha/i }));

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('No se pudo guardar la ficha. Verifica los datos.', { tone: 'error' }));
    expect(onCloseDirty).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Cerrar panel/i }));
    fireEvent.click(screen.getByRole('button', { name: /Descartar y cerrar/i }));
    expect(onCloseDirty).toHaveBeenCalledTimes(1);
  });
});
