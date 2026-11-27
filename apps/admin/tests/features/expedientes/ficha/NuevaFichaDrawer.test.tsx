import { createContext, StrictMode, useContext, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { StaffRole, StaffUser } from '@/domain/models/Auth';
import type { ExpedienteResumen } from '@/domain/models/Persona';

const {
  createCompleteMock,
  verifyByCurpMock,
  listCatalogoMock,
  listAsentamientosMock,
  toastMock,
  authState,
} = vi.hoisted(() => ({
  createCompleteMock: vi.fn(),
  verifyByCurpMock: vi.fn(),
  listCatalogoMock: vi.fn(),
  listAsentamientosMock: vi.fn(),
  toastMock: vi.fn(),
  authState: { user: null as StaffUser | null },
}));

vi.mock('@/shared/auth/useAuth', () => ({
  useAuth: () => ({ status: 'authenticated', user: authState.user }),
}));

vi.mock('gsap', () => ({ gsap: { fromTo: vi.fn() } }));
vi.mock('@/infrastructure/supabase/adapters/SupabaseExpedienteRepository', () => ({
  supabaseExpedienteRepository: {
    list: vi.fn(),
    verifyByCurp: verifyByCurpMock,
    registerConsult: vi.fn(),
  },
}));
vi.mock('@/infrastructure/supabase/adapters/SupabaseFichaRepository', () => ({
  supabaseFichaRepository: { createComplete: createCompleteMock, getDetail: vi.fn(), archive: vi.fn(), deactivate: vi.fn() },
}));
vi.mock('@/infrastructure/supabase/adapters/SupabaseSepomexRepository', () => ({
  supabaseSepomexRepository: { listCatalogo: listCatalogoMock, listAsentamientos: listAsentamientosMock },
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
    LoadingButton: ({ children, type, form, state, disabled }: { children?: ReactNode; type?: 'button' | 'submit'; form?: string; state?: string; disabled?: boolean }) => (
      <button type={type ?? 'button'} form={form} data-state={state} disabled={disabled}>{children}</button>
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
    // `agresor/motionCompat` lo lee al evaluar el módulo (el paso Agresor entra en el wizard).
    useCascade: () => undefined,
    toast: toastMock,
  };
});

import { NuevaFichaDrawer } from '@/features/expedientes/ficha/NuevaFichaDrawer';

function setTestRole(role: StaffRole) {
  authState.user = {
    id: 'emp-1',
    email: 'test@semujeres.local',
    displayName: 'Personal de prueba',
    role,
    areaId: 1,
    areaClave: role === 'recepcion' ? 'recepcion' : 'ts',
    areaNombre: role === 'recepcion' ? 'Recepción' : 'Trabajo Social',
    activo: true,
  };
}

function renderDrawer(props: Partial<Parameters<typeof NuevaFichaDrawer>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onClose = props.onClose ?? vi.fn();
  return {
    onClose,
    ...render(
      <StrictMode>
        <QueryClientProvider client={client}>
          <NuevaFichaDrawer
            open={props.open ?? true}
            seed={props.seed ?? null}
            onClose={onClose}
            onCreated={props.onCreated}
            onOpenExpediente={props.onOpenExpediente}
            allowPreRegistroLookup={props.allowPreRegistroLookup}
          />
        </QueryClientProvider>
      </StrictMode>,
    ),
  };
}

// Estado civil, escolaridad y ocupación son obligatorios en la Ficha Única.
function fillSelectsObligatorios() {
  fireEvent.change(screen.getByLabelText(/Estado civil \*/i), { target: { value: 'soltero' } });
  fireEvent.change(screen.getByLabelText(/Escolaridad \*/i), { target: { value: 'preparatoria' } });
  // El paso de persona agresora (oculto en el mock) también tiene «Ocupación *»: el de identidad es el primero.
  fireEvent.change(screen.getAllByLabelText(/Ocupación \*/i)[0], { target: { value: '2' } });
}

function fillStep0() {
  fireEvent.change(screen.getByLabelText(/CURP \*/i), { target: { value: 'GALA900512MSLNRR01' } });
  fireEvent.change(screen.getByLabelText(/Nombre\(s\) \*/i), { target: { value: 'Laura' } });
  fireEvent.change(screen.getByLabelText(/Apellido paterno \*/i), { target: { value: 'García' } });
  fillSelectsObligatorios();
  fireEvent.change(screen.getByLabelText(/Servicios solicitados \*/i), { target: { value: '1' } });
}

// El número exterior es obligatorio (se admite "S/N").
function fillNumeroExterior() {
  fireEvent.change(screen.getByLabelText(/Número exterior \*/i), { target: { value: 'S/N' } });
}

const EXISTING_EXPEDIENTE: ExpedienteResumen = {
  id: 'ficha-existente-1',
  folio: 'SEM-2026-0001',
  estado: 'en_seguimiento',
  creadoEn: '2026-11-20T10:00:00Z',
  actualizadoEn: '2026-11-25T10:00:00Z',
  enListaUrgencias: false,
  persona: {
    id: 'persona-existente-1',
    curp: 'MEZA910315MSLGRN04',
    nombres: 'Adriana',
    apellidoPaterno: 'Meza',
    apellidoMaterno: 'Gutiérrez',
    nombreCompleto: 'Adriana Meza Gutiérrez',
    sexo: 'M',
    fechaNacimiento: '1991-03-15',
    entidadNacimiento: 'SL',
    celular: '6681000001',
  },
};

beforeEach(() => {
  setTestRole('trabajo_social');
  createCompleteMock.mockReset().mockResolvedValue({ fichaId: 'ficha-99', folio: 'SEM-2026-0099', personaId: 'p-1' });
  verifyByCurpMock.mockReset().mockImplementation((curp: string) => Promise.resolve({ kind: 'nuevo', curp }));
  const catalogos: Record<string, { id: number; clave: string; nombre: string }[]> = {
    area: [{ id: 1, clave: 'ts', nombre: 'Trabajo Social' }],
    ocupacion: [{ id: 2, clave: 'emp', nombre: 'Empleada' }],
    parentesco: [{ id: 3, clave: 'hermana', nombre: 'Hermana' }],
  };
  listCatalogoMock.mockReset().mockImplementation((nombre: string) => Promise.resolve(catalogos[nombre] ?? []));
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

afterEach(() => {
  cleanup();
  authState.user = null;
});

describe('NuevaFichaDrawer (verificación inline de CURP, validación, navegación y cambios sin guardar)', () => {
  it('valida cada paso, enfoca el primer campo inválido y guarda la ficha', async () => {
    const onCreated = vi.fn();
    const { onClose } = renderDrawer({ onCreated });
    await waitFor(() => {
      expect(listCatalogoMock).toHaveBeenCalledWith('area');
      expect(listCatalogoMock).toHaveBeenCalledWith('ocupacion');
      expect(listCatalogoMock).toHaveBeenCalledWith('parentesco');
    });

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
    fillNumeroExterior();
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    // Paso opcional de persona agresora: se puede avanzar sin capturar datos.
    expect(screen.getByText(/Datos de la persona agresora \(opcional\)/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    expect(screen.getByText(/Estudio socioeconómico y vivienda/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Atrás/i }));
    fireEvent.click(screen.getByRole('button', { name: /Atrás/i }));
    expect((screen.getByLabelText(/Calle \*/i) as HTMLInputElement).value).toBe('Av. Hidalgo 120');

    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    fireEvent.click(screen.getByRole('button', { name: /Guardar ficha/i }));

    await waitFor(() => expect(createCompleteMock).toHaveBeenCalledTimes(1));
    expect(toastMock).toHaveBeenCalledWith('Expediente SEM-2026-0099 registrado.');
    expect(onCreated).toHaveBeenCalledWith('ficha-99');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('al pasar de paso (Siguiente y Atrás) devuelve el scroll del cuerpo del panel al inicio del formulario', async () => {
    renderDrawer();
    await waitFor(() => expect(listCatalogoMock).toHaveBeenCalledWith('parentesco'));

    // El cuerpo del Drawer es el contenedor desplazable; el formulario quedó fuera de vista (usuaria abajo, en Siguiente).
    const body = document.querySelector<HTMLElement>('[data-mk-part="body"]')!;
    const form = document.querySelector<HTMLFormElement>('form')!;
    body.style.overflowY = 'auto';
    body.scrollTop = 600;
    const scrollTo = vi.fn();
    body.scrollTo = scrollTo as unknown as typeof body.scrollTo;
    body.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    form.getBoundingClientRect = () => ({ top: -580 }) as DOMRect;

    fillStep0();
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    await screen.findByText(/Domicilio de la usuaria/i);
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1));
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 4, behavior: 'smooth' });

    body.scrollTop = 600;
    fireEvent.click(screen.getByRole('button', { name: /Atrás/i }));
    await screen.findByText(/Datos de identidad y servicios solicitados/i);
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(2));
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 4, behavior: 'smooth' });
  });

  it('muestra alerta inline de CURP duplicada, bloquea avanzar y permite abrir el expediente existente', async () => {
    verifyByCurpMock.mockResolvedValue({
      kind: 'expediente_existente',
      expediente: EXISTING_EXPEDIENTE,
    });
    const onOpenExpediente = vi.fn();
    const { onClose } = renderDrawer({ onOpenExpediente });

    fireEvent.change(screen.getByLabelText(/CURP \*/i), {
      target: { value: EXISTING_EXPEDIENTE.persona.curp },
    });

    await waitFor(() => {
      expect(verifyByCurpMock).toHaveBeenCalledWith(EXISTING_EXPEDIENTE.persona.curp, true);
    });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Esta persona ya tiene expediente SEM-2026-0001/i);

    // El botón Siguiente queda bloqueado (RN-02) y el paso de Domicilio sigue oculto.
    const nextButton = screen.getByRole('button', { name: /Siguiente/i }) as HTMLButtonElement;
    expect(nextButton.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Domicilio' }));
    expect(screen.getByText(/Datos de identidad y servicios solicitados/i).closest('[data-mk-step]')?.hasAttribute('hidden')).toBe(false);

    // No debe exponer la CURP en ningún toast.
    for (const call of toastMock.mock.calls) {
      expect(String(call[0])).not.toContain(EXISTING_EXPEDIENTE.persona.curp);
    }

    fireEvent.click(screen.getByRole('button', { name: /Abrir expediente/i }));
    expect(onOpenExpediente).toHaveBeenCalledWith(EXISTING_EXPEDIENTE);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('reutiliza existingPersonaId y precarga datos cuando existe persona sin ficha o pre-registro móvil', async () => {
    verifyByCurpMock.mockResolvedValueOnce({
      kind: 'persona_sin_ficha',
      persona: {
        id: 'persona-padron-1',
        curp: 'GALA900512MSLNRR01',
        nombres: 'Laura',
        apellidoPaterno: 'García',
        apellidoMaterno: 'Lara',
        nombreCompleto: 'Laura García Lara',
        sexo: 'M',
        fechaNacimiento: '1990-05-12',
        entidadNacimiento: 'SL',
        celular: '6681112233',
      },
    });

    renderDrawer();
    fireEvent.change(screen.getByLabelText(/CURP \*/i), { target: { value: 'GALA900512MSLNRR01' } });

    await screen.findByText(/Persona registrada en padrón sin Ficha Única activa/i);
    expect((screen.getByLabelText(/Nombre\(s\) \*/i) as HTMLInputElement).value).toBe('Laura');
    expect((screen.getByLabelText(/Apellido paterno \*/i) as HTMLInputElement).value).toBe('García');
    expect((screen.getByLabelText(/Apellido materno/i) as HTMLInputElement).value).toBe('Lara');
    expect((screen.getByLabelText(/Teléfono celular/i) as HTMLInputElement).value).toBe('6681112233');

    fillSelectsObligatorios();
    fireEvent.change(screen.getByLabelText(/Servicios solicitados \*/i), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    await waitFor(() => expect(listAsentamientosMock).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(/Código postal/i), { target: { value: '80000' } });
    await screen.findByText(/sin\s+asentamientos en catálogo local/i);
    fireEvent.change(screen.getByLabelText(/Calle \*/i), { target: { value: 'Calle 5' } });
    fillNumeroExterior();
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    fireEvent.click(screen.getByRole('button', { name: /Guardar ficha/i }));

    await waitFor(() => expect(createCompleteMock).toHaveBeenCalledTimes(1));
    expect(createCompleteMock.mock.calls[0][0].identidad.existingPersonaId).toBe('persona-padron-1');

    cleanup();
    verifyByCurpMock.mockResolvedValueOnce({
      kind: 'pre_registro_movil',
      preRegistro: {
        preRegistroId: 'pre-1',
        curp: 'LOPA880720MSLNRR09',
        nombres: 'Sofía',
        apellidoPaterno: 'López',
        apellidoMaterno: 'Paredes',
        nombreCompleto: 'Sofía López Paredes',
        sexo: 'M',
        fechaNacimiento: '1988-07-20',
        entidadNacimiento: 'SL',
        celular: '6689990000',
        personaId: 'persona-movil-1',
      },
    });

    renderDrawer();
    fireEvent.change(screen.getByLabelText(/CURP \*/i), { target: { value: 'LOPA880720MSLNRR09' } });
    await screen.findByText(/Datos de la app encontrados/i);

    fireEvent.click(screen.getByRole('button', { name: /Usar estos datos/i }));
    expect((screen.getByLabelText(/Nombre\(s\) \*/i) as HTMLInputElement).value).toBe('Sofía');
    expect((screen.getByLabelText(/Apellido paterno \*/i) as HTMLInputElement).value).toBe('López');
    expect(screen.getAllByText('1988-07-20').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Femenino/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Sinaloa \(SL\)/)).toBeTruthy();
  });

  it('respeta restricciones de recepción al verificar CURP sin mostrar detalles ni permitir abrir expediente', async () => {
    setTestRole('recepcion');
    verifyByCurpMock.mockResolvedValueOnce({
      kind: 'expediente_existente',
      expediente: {
        ...EXISTING_EXPEDIENTE,
        id: '',
      },
    });

    renderDrawer({ onOpenExpediente: vi.fn() });
    fireEvent.change(screen.getByLabelText(/CURP \*/i), {
      target: { value: EXISTING_EXPEDIENTE.persona.curp },
    });

    await waitFor(() => {
      expect(verifyByCurpMock).toHaveBeenCalledWith(EXISTING_EXPEDIENTE.persona.curp, false);
    });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Esta persona ya tiene expediente SEM-2026-0001/i);
    expect(screen.queryByRole('button', { name: /Abrir expediente/i })).toBeNull();
    expect(screen.queryByText(/Adriana Meza Gutiérrez/i)).toBeNull();
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

    // Los catálogos (ocupación) cargan de forma asíncrona: sin esperarlos el select obligatorio queda vacío.
    await screen.findByRole('option', { name: 'Empleada' });
    fillStep0();
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    await waitFor(() => expect(listAsentamientosMock).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(/Código postal/i), { target: { value: '80000' } });
    await screen.findByText(/sin\s+asentamientos en catálogo local/i);
    fireEvent.change(screen.getByLabelText(/Calle \*/i), { target: { value: 'Calle 10' } });
    fillNumeroExterior();
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    fireEvent.click(screen.getByRole('button', { name: /Guardar ficha/i }));

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('No se pudo guardar la ficha. Verifica los datos.', { tone: 'error' }));
    expect(onCloseDirty).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Cerrar panel/i }));
    fireEvent.click(screen.getByRole('button', { name: /Descartar y cerrar/i }));
    expect(onCloseDirty).toHaveBeenCalledTimes(1);
  });
});
