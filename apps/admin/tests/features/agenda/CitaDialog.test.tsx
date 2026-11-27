import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgendaItem } from '@/domain/models/Cita';
import type { StaffRole } from '@/domain/models/Auth';

const originalResizeObserver = globalThis.ResizeObserver;

beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
});

const { useAuthMock, toastMock, cambiarEstadoMock, reagendarMock, crearMock, listCatalogoMock, getContextoMock, buscarPersonasMock } =
  vi.hoisted(() => ({
    useAuthMock: vi.fn(),
    toastMock: vi.fn(),
    cambiarEstadoMock: vi.fn(),
    reagendarMock: vi.fn(),
    crearMock: vi.fn(),
    listCatalogoMock: vi.fn(),
    getContextoMock: vi.fn(),
    buscarPersonasMock: vi.fn(),
  }));

vi.mock('@/shared/auth/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/auth/useAuth')>()),
  useAuth: useAuthMock,
}));

vi.mock('@yewdiel21/motion-kit/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@yewdiel21/motion-kit/react')>()),
  toast: toastMock,
}));

vi.mock('@/infrastructure/supabase/adapters/SupabaseCitaRepository', () => ({
  supabaseCitaRepository: {
    listarAgenda: vi.fn().mockResolvedValue([]),
    listarUrgencias: vi.fn().mockResolvedValue([]),
    crear: crearMock,
    cambiarEstado: cambiarEstadoMock,
    reagendar: reagendarMock,
    buscarPersonas: buscarPersonasMock,
  },
}));

vi.mock('@/infrastructure/supabase/adapters/SupabaseSepomexRepository', () => ({
  supabaseSepomexRepository: {
    listCatalogo: listCatalogoMock,
    listAsentamientos: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/infrastructure/supabase/adapters/SupabaseSeguimientoRepository', () => ({
  supabaseSeguimientoRepository: {
    contexto: getContextoMock,
    listarTiposAtencion: vi.fn().mockResolvedValue([]),
    registrar: vi.fn(),
  },
}));

import { CitaDialog, type CitaDialogState } from '@/features/agenda/CitaDialog';

const AREAS = [
  { id: 1, clave: 'trabajo_social', nombre: 'Trabajo Social' },
  { id: 2, clave: 'psicologia', nombre: 'Psicología' },
  { id: 3, clave: 'juridico', nombre: 'Jurídico' },
];

function cita(overrides: Partial<AgendaItem> = {}): AgendaItem {
  return {
    citaId: 'c1',
    programadaEn: '2026-11-26T17:00:00Z',
    estado: 'agendada',
    prioridad: 'alta',
    areaId: 1,
    areaClave: 'trabajo_social',
    recomendadaPor: null,
    reagendadaDe: null,
    origen: 'regular',
    personaId: 'p1',
    nombreCompleto: 'Ana López Pérez',
    celular: '6671234567',
    ...overrides,
  };
}

function login(role: StaffRole, areaId: number | null) {
  useAuthMock.mockReturnValue({
    status: 'authenticated',
    user: {
      id: 'u1',
      email: 'x@y.z',
      displayName: 'Usuaria',
      role,
      areaId,
      areaClave: AREAS.find((a) => a.id === areaId)?.clave ?? null,
      areaNombre: null,
      dependencia: null,
      activo: true,
      permisos: [],
    },
  });
}

function renderDialog(state: CitaDialogState | null, onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  const utils = render(<CitaDialog state={state} onClose={onClose} />, { wrapper: wrap });
  return { ...utils, onClose };
}

const DIA = new Date(2026, 10, 26);
const HIDDEN = { hidden: true } as const;

beforeEach(() => {
  listCatalogoMock.mockResolvedValue(AREAS);
  getContextoMock.mockResolvedValue(null);
  buscarPersonasMock.mockResolvedValue([]);
  cambiarEstadoMock.mockImplementation(async (citaId: string, estado: AgendaItem['estado']) => ({
    citaId,
    estado,
    confirmadaEn: null,
  }));
  login('trabajo_social', 1);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CitaDialog · vista día', () => {
  const citas = [
    cita({ citaId: 'c2', programadaEn: '2026-11-26T19:00:00Z', nombreCompleto: 'Beatriz Ruiz', estado: 'confirmada' }),
    cita(),
  ];

  it('muestra el título del día, las citas ordenadas por hora y navega a detalle y de regreso', async () => {
    renderDialog({ kind: 'dia', fecha: DIA, citas });

    await waitFor(() => expect(screen.getByText('Jueves 26 de noviembre')).toBeTruthy());
    const rows = await screen.findAllByRole('button', { name: /Ana López|Beatriz Ruiz/, ...HIDDEN });
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Ana López Pérez'),
      expect.stringContaining('Beatriz Ruiz'),
    ]);
    expect(screen.getAllByText('Agendada').length).toBeGreaterThan(0);

    fireEvent.click(rows[0]);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Volver', ...HIDDEN })).toBeTruthy());
    expect(screen.getByText('Datos generales')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Volver', ...HIDDEN }));
    await waitFor(() => expect(screen.getByRole('list', { name: 'Citas del día', ...HIDDEN })).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Volver', ...HIDDEN })).toBeNull();
  });

  it('pinta la lista al instante, sin esqueleto de carga', async () => {
    renderDialog({ kind: 'dia', fecha: DIA, citas });

    expect(screen.queryByRole('status', { name: 'Cargando cita', ...HIDDEN })).toBeNull();
    expect(screen.getByRole('list', { name: 'Citas del día', ...HIDDEN })).toBeTruthy();
  });

  it('la insignia de hora es compacta: «10:00» y «a.m.» por separado', async () => {
    renderDialog({ kind: 'dia', fecha: DIA, citas });

    const rows = await screen.findAllByRole('button', { name: /Ana López/, ...HIDDEN });
    const horas = rows[0].querySelector('.vc-cita-time__hora');
    const periodo = rows[0].querySelector('.vc-cita-time__periodo');
    expect(horas?.textContent).toBe('10:00');
    expect(periodo?.textContent).toBe('a.m.');
  });

  it('«Nueva cita» abre el formulario de alta y «Cancelar» regresa a la lista', async () => {
    login('recepcion', null);
    renderDialog({ kind: 'dia', fecha: DIA, citas });

    fireEvent.click(await screen.findByRole('button', { name: /Nueva cita/, ...HIDDEN }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Agendar cita', ...HIDDEN })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar', ...HIDDEN }));
    await waitFor(() => expect(screen.getByRole('list', { name: 'Citas del día', ...HIDDEN })).toBeTruthy());
  });
});

describe('CitaDialog · vista día sin permiso de alta', () => {
  const citas = [cita()];

  it.each<[StaffRole, number | null]>([['trabajo_social', 1]])('%s ve las citas pero ningún «Nueva cita»', async (role, areaId) => {
    login(role, areaId);
    renderDialog({ kind: 'dia', fecha: DIA, citas });

    expect(await screen.findByRole('list', { name: 'Citas del día', ...HIDDEN })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Nueva cita/, ...HIDDEN })).toBeNull();
  });

  it('un día vacío muestra el estado vacío sin botón de alta', async () => {
    login('trabajo_social', 1);
    renderDialog({ kind: 'dia', fecha: DIA, citas: [] });

    expect(await screen.findByText('Sin citas este día')).toBeTruthy();
    expect(screen.getByText('No hay citas programadas para este día.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Nueva cita/, ...HIDDEN })).toBeNull();
  });

  it.each<[StaffRole, number | null]>([
    ['recepcion', null],
    ['juridico', 3],
    ['psicologia', 2],
    ['titular', null],
    ['subdireccion', null],
  ])('%s sí ve «Nueva cita» en un día vacío', async (role, areaId) => {
    login(role, areaId);
    renderDialog({ kind: 'dia', fecha: DIA, citas: [] });
    expect(await screen.findByRole('button', { name: /Nueva cita/, ...HIDDEN })).toBeTruthy();
  });

  it('marca las citas UMECA con la insignia «asistencia obligatoria» en la lista y el detalle', async () => {
    login('recepcion', null);
    renderDialog({
      kind: 'dia',
      fecha: DIA,
      citas: [
        cita({ citaId: 'u1', origen: 'umeca', nombreCompleto: 'Rosa Umeca' }),
        cita({ citaId: 'r1', nombreCompleto: 'Zoe Regular', programadaEn: '2026-11-26T20:00:00Z' }),
      ],
    });

    const filas = await screen.findAllByRole('button', { name: /Rosa Umeca|Zoe Regular/, ...HIDDEN });
    expect(filas[0].textContent).toContain('UMECA · asistencia obligatoria');
    expect(filas[1].textContent).not.toContain('UMECA');

    fireEvent.click(filas[0]);
    await screen.findByText('Datos generales');
    expect(screen.getAllByText('UMECA · asistencia obligatoria').length).toBeGreaterThan(0);
  });
});

describe('CitaDialog · detalle y acciones', () => {
  /** `conMenu`: espera al menú ⋮ (se monta tras el morph de apertura: `useDialogSettled`). */
  async function abrirDetalle(item: AgendaItem, conMenu = true) {
    const utils = renderDialog({ kind: 'detalle', cita: item });
    await screen.findByText('Datos generales');
    if (conMenu) await screen.findByRole('button', { name: 'Más acciones', ...HIDDEN });
    return utils;
  }

  /** Reagendar / Cancelar cita viven en el menú ⋮ del encabezado; el resto, en el pie del diálogo. */
  function accion(name: string) {
    return screen.queryByRole('menuitem', { name, ...HIDDEN }) ?? screen.queryByRole('button', { name, ...HIDDEN });
  }

  function botones() {
    const has = (name: string) => accion(name) !== null;
    return {
      confirmar: has('Confirmar'),
      asistio: has('Marcar asistió'),
      noAsistio: has('No asistió'),
      cancelar: has('Cancelar cita'),
      reagendar: has('Reagendar'),
      siguiente: has('Agendar siguiente cita'),
    };
  }

  it('el detalle se pinta sin esqueleto y organiza paciente, fecha/hora y datos generales', async () => {
    renderDialog({ kind: 'detalle', cita: cita() });

    expect(screen.queryByRole('status', { name: 'Cargando cita', ...HIDDEN })).toBeNull();
    expect(await screen.findByText('Paciente')).toBeTruthy();
    expect(screen.getByText('Fecha y hora')).toBeTruthy();
    expect(screen.getByText('Datos generales')).toBeTruthy();
    expect(screen.getByText('Ana López Pérez')).toBeTruthy();
    expect(screen.getByText('6671234567')).toBeTruthy();
    expect(screen.getByText('Prioridad alta')).toBeTruthy();
    expect(screen.getByText('Agendada')).toBeTruthy();
  });

  it('«Ver expediente» es un enlace con ícono open_in_new cuando la persona tiene ficha', async () => {
    getContextoMock.mockResolvedValue({
      fichaId: 'f1',
      folioExpediente: 'SEM-2026-0001',
      nombrePersona: 'Ana López Pérez',
      edad: 28,
      esPrimeraVezArea: true,
      ultimaProximaAccion: null,
      tieneOrdenVigente: false,
      tieneHistorialClinico: null,
    });
    renderDialog({ kind: 'detalle', cita: cita() });

    const link = await screen.findByRole('link', { name: 'Ver expediente de Ana López Pérez', ...HIDDEN });
    expect(link.getAttribute('href')).toBe('/expedientes/f1');
    expect(link.textContent).toBe('open_in_new');
  });

  it('cita agendada: confirmar, asistió, no asistió y cancelar (Trabajo Social no reagenda)', async () => {
    await abrirDetalle(cita());
    // Reagendar crea una cita nueva: sigue la regla de alta, y Trabajo Social no agenda.
    expect(botones()).toEqual({
      confirmar: true,
      asistio: true,
      noAsistio: true,
      cancelar: true,
      reagendar: false,
      siguiente: false,
    });
  });

  it('Jurídico, Psicología y Dirección reagendan según la regla de alta', async () => {
    login('juridico', 3);
    await abrirDetalle(cita({ areaId: 3, areaClave: 'juridico' }));
    expect(botones().reagendar).toBe(true);
    cleanup();

    login('titular', null);
    await abrirDetalle(cita());
    expect(botones()).toMatchObject({ confirmar: true, cancelar: true, reagendar: true });
    cleanup();

    login('psicologia', 2);
    await abrirDetalle(cita({ areaId: 2, areaClave: 'psicologia' }));
    expect(botones().reagendar).toBe(true);
  });

  it('Recepción gestiona y reagenda también las citas de Jurídico', async () => {
    login('recepcion', null);
    await abrirDetalle(cita({ areaId: 3, areaClave: 'juridico' }));
    expect(botones()).toMatchObject({ confirmar: true, noAsistio: true, cancelar: true, reagendar: true, asistio: false });
  });

  it('cita confirmada: ya no se ofrece confirmar', async () => {
    await abrirDetalle(cita({ estado: 'confirmada' }));
    expect(botones()).toMatchObject({ confirmar: false, asistio: true, noAsistio: true, cancelar: true, reagendar: false });
  });

  it('citas en estado final no ofrecen acciones', async () => {
    await abrirDetalle(cita({ estado: 'cancelada' }), false);
    expect(botones()).toEqual({
      confirmar: false,
      asistio: false,
      noAsistio: false,
      cancelar: false,
      reagendar: false,
      siguiente: false,
    });
    expect(screen.getByText('Esta cita ya no admite cambios de estado.')).toBeTruthy();
  });

  it('recepción puede confirmar/cancelar/reagendar pero no marcar asistió (lo hace el área con la hoja)', async () => {
    login('recepcion', null);
    await abrirDetalle(cita());
    expect(botones()).toMatchObject({ confirmar: true, asistio: false, noAsistio: true, cancelar: true, reagendar: true });
  });

  it('un área no gestiona citas de otra área', async () => {
    login('juridico', 3);
    await abrirDetalle(cita({ areaId: 1, areaClave: 'trabajo_social' }), false);
    expect(botones()).toMatchObject({ confirmar: false, asistio: false, cancelar: false, reagendar: false });
  });

  it('permite cancelar SIN motivo y actualiza el estado en la vista', async () => {
    await abrirDetalle(cita());

    fireEvent.click(accion('Cancelar cita')!);
    const confirmar = await screen.findByRole('button', { name: 'Confirmar cancelación', ...HIDDEN });
    fireEvent.click(confirmar);

    await waitFor(() => expect(cambiarEstadoMock).toHaveBeenCalledWith('c1', 'cancelada', undefined));
    await waitFor(() => expect(screen.getByText('Cancelada')).toBeTruthy());
    expect(toastMock).toHaveBeenCalledWith('Cita cancelada.', { tone: 'success' });
  });

  it('envía el motivo de cancelación cuando se escribe', async () => {
    await abrirDetalle(cita());

    fireEvent.click(accion('Cancelar cita')!);
    fireEvent.change(await screen.findByLabelText(/Motivo de cancelación/), { target: { value: '  Cambió de domicilio ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación', ...HIDDEN }));

    await waitFor(() => expect(cambiarEstadoMock).toHaveBeenCalledWith('c1', 'cancelada', 'Cambió de domicilio'));
  });

  it('confirmar cambia el estado y el chip lo refleja', async () => {
    await abrirDetalle(cita());

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar', ...HIDDEN }));

    await waitFor(() => expect(cambiarEstadoMock).toHaveBeenCalledWith('c1', 'confirmada', undefined));
    await waitFor(() => expect(screen.getByText('Confirmada')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Confirmar', ...HIDDEN })).toBeNull();
  });

  it('muestra el error del servidor en un toast', async () => {
    cambiarEstadoMock.mockRejectedValueOnce({ code: '23514', message: 'Transición de estado de cita no permitida' });
    await abrirDetalle(cita());

    fireEvent.click(screen.getByRole('button', { name: 'No asistió', ...HIDDEN }));

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Transición de estado de cita no permitida', { tone: 'error' }));
  });

  it('«Marcar asistió» abre la hoja de seguimiento sin llamar a cambiar_estado_cita', async () => {
    getContextoMock.mockResolvedValue({
      fichaId: 'f1',
      folioExpediente: 'SEM-2026-0001',
      nombrePersona: 'Ana López Pérez',
      edad: 28,
      esPrimeraVezArea: true,
      ultimaProximaAccion: null,
      tieneOrdenVigente: false,
      tieneHistorialClinico: null,
    });
    await abrirDetalle(cita());

    fireEvent.click(screen.getByRole('button', { name: 'Marcar asistió', ...HIDDEN }));

    await waitFor(() => expect(screen.getByRole('form', { name: 'Hoja de seguimiento', ...HIDDEN })).toBeTruthy());
    expect(screen.getByText('Datos al día de la sesión')).toBeTruthy();
    expect(cambiarEstadoMock).not.toHaveBeenCalled();
  });

  it('«Agendar siguiente cita» aparece según la regla de alta, salvo para Trabajo Social', async () => {
    login('juridico', 3);
    await abrirDetalle(cita({ estado: 'asistio', areaId: 3, areaClave: 'juridico' }), false);
    expect(botones().siguiente).toBe(true);
    cleanup();

    login('psicologia', 2);
    await abrirDetalle(cita({ estado: 'asistio', areaId: 2, areaClave: 'psicologia' }), false);
    expect(botones().siguiente).toBe(true);
    cleanup();

    login('recepcion', null);
    await abrirDetalle(cita({ estado: 'asistio', areaId: 3, areaClave: 'juridico' }), false);
    expect(botones().siguiente).toBe(true);
    cleanup();

    login('trabajo_social', 1);
    await abrirDetalle(cita({ estado: 'asistio' }), false);
    expect(botones().siguiente).toBe(false);
  });

  it('«Agendar siguiente cita» abre el alta con la persona y el área precargadas', async () => {
    login('juridico', 3);
    await abrirDetalle(cita({ estado: 'asistio', areaId: 3, areaClave: 'juridico' }), false);

    fireEvent.click(screen.getByRole('button', { name: 'Agendar siguiente cita', ...HIDDEN }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Agendar cita', ...HIDDEN })).toBeTruthy());
    expect(screen.getByText('Ana López Pérez')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Jurídico', checked: true, ...HIDDEN })).toBeTruthy());
  });
});

describe('CitaDialog · crear', () => {
  const MARIA = {
    personaId: 'p9',
    fichaId: 'f1',
    folio: 'SEM-2026-0001',
    nombreCompleto: 'María Meza',
    curpEnmascarada: 'MEZA91****MSLGRN04',
    celular: '6671234567',
  };

  async function buscarYElegirMaria() {
    const input = await screen.findByRole('combobox', { name: 'Persona', ...HIDDEN });
    fireEvent.change(input, { target: { value: 'Mar' } });
    const opcion = await screen.findByRole('option', { name: /María Meza/, ...HIDDEN }, { timeout: 3000 });
    fireEvent.click(opcion);
  }

  it('Recepción agenda en Trabajo Social, Psicología y Jurídico', async () => {
    login('recepcion', null);
    renderDialog({ kind: 'crear', fecha: DIA });

    await screen.findByRole('radio', { name: 'Psicología', ...HIDDEN });
    expect(screen.getByRole('radio', { name: 'Trabajo Social', ...HIDDEN })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Jurídico', ...HIDDEN })).toBeTruthy();
    expect(screen.getByText(/inicio de la CURP/)).toBeTruthy();
  });

  it('Jurídico solo ve Jurídico (preseleccionada)', async () => {
    login('juridico', 3);
    renderDialog({ kind: 'crear', fecha: DIA });

    const juridico = await screen.findByRole('radio', { name: 'Jurídico', ...HIDDEN });
    expect(juridico.getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByRole('radio', { name: 'Psicología', ...HIDDEN })).toBeNull();
  });

  it('Psicología solo ve Psicología (preseleccionada)', async () => {
    login('psicologia', 2);
    renderDialog({ kind: 'crear', fecha: DIA });

    const psicologia = await screen.findByRole('radio', { name: 'Psicología', ...HIDDEN });
    expect(psicologia.getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByRole('radio', { name: 'Jurídico', ...HIDDEN })).toBeNull();
  });

  it('Dirección agenda en todas las áreas', async () => {
    login('titular', null);
    renderDialog({ kind: 'crear', fecha: DIA });

    await screen.findByRole('radio', { name: 'Psicología', ...HIDDEN });
    expect(screen.getByRole('radio', { name: 'Trabajo Social', ...HIDDEN })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Jurídico', ...HIDDEN })).toBeTruthy();
  });

  it('no busca con menos de 3 caracteres; con 3 busca con retardo y muestra nombre, CURP enmascarada y folio', async () => {
    login('recepcion', null);
    buscarPersonasMock.mockResolvedValue([MARIA]);
    renderDialog({ kind: 'crear', fecha: DIA });

    const input = await screen.findByRole('combobox', { name: 'Persona', ...HIDDEN });
    fireEvent.change(input, { target: { value: 'Ma' } });
    await new Promise((r) => setTimeout(r, 450));
    expect(buscarPersonasMock).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'Mar' } });
    expect(buscarPersonasMock).not.toHaveBeenCalled();
    const opcion = await screen.findByRole('option', { name: /María Meza/, ...HIDDEN }, { timeout: 3000 });
    expect(buscarPersonasMock).toHaveBeenCalledTimes(1);
    expect(buscarPersonasMock).toHaveBeenCalledWith('Mar', 10);
    expect(opcion.textContent).toContain('MEZA91****MSLGRN04');
    expect(opcion.textContent).toContain('SEM-2026-0001');
  });

  it('todos los roles que agendan usan el mismo RPC de búsqueda', async () => {
    login('psicologia', 2);
    buscarPersonasMock.mockResolvedValue([MARIA]);
    renderDialog({ kind: 'crear', fecha: DIA });

    await buscarYElegirMaria();
    expect(buscarPersonasMock).toHaveBeenCalledWith('Mar', 10);
  });

  it('busca la persona con retardo, agenda la cita y cierra', async () => {
    login('recepcion', null);
    buscarPersonasMock.mockResolvedValue([MARIA]);
    crearMock.mockResolvedValue({ id: 'n1', estado: 'agendada', programadaEn: '2026-11-26T16:00:00Z' });
    const { onClose } = renderDialog({ kind: 'crear', fecha: DIA });

    await buscarYElegirMaria();

    fireEvent.click(await screen.findByRole('radio', { name: 'Psicología', ...HIDDEN }));
    fireEvent.click(screen.getByRole('button', { name: 'Agendar cita', ...HIDDEN }));

    await waitFor(() =>
      expect(crearMock).toHaveBeenCalledWith({
        personaId: 'p9',
        areaId: 2,
        programadaEn: '2026-11-26T09:00:00-07:00',
        prioridad: null,
        recomendadaPor: null,
        origen: 'regular',
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toastMock).toHaveBeenCalledWith(expect.stringContaining('Cita agendada'), { tone: 'success' });
  });

  it('no agenda sin persona y muestra el error de validación', async () => {
    login('recepcion', null);
    renderDialog({ kind: 'crear', fecha: DIA });

    fireEvent.click(await screen.findByRole('radio', { name: 'Psicología', ...HIDDEN }));
    fireEvent.click(screen.getByRole('button', { name: 'Agendar cita', ...HIDDEN }));

    await waitFor(() => expect(screen.getAllByText('Selecciona la persona para agendar la cita.').length).toBeGreaterThan(0));
    expect(crearMock).not.toHaveBeenCalled();
  });

  it('muestra en un toast el error del servidor al agendar y no cierra', async () => {
    login('recepcion', null);
    buscarPersonasMock.mockResolvedValue([MARIA]);
    crearMock.mockRejectedValue({
      code: '23514',
      message: 'Psicología y Jurídico solo atienden a personas mayores de 18 años (RN-01)',
    });
    const { onClose } = renderDialog({ kind: 'crear', fecha: DIA });

    await buscarYElegirMaria();
    fireEvent.click(await screen.findByRole('radio', { name: 'Psicología', ...HIDDEN }));
    fireEvent.click(screen.getByRole('button', { name: 'Agendar cita', ...HIDDEN }));

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.stringContaining('mayores de 18 años'), { tone: 'error' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('«Cita obligatoria (UMECA)» agenda con origen umeca', async () => {
    login('recepcion', null);
    buscarPersonasMock.mockResolvedValue([MARIA]);
    crearMock.mockResolvedValue({ id: 'n2', estado: 'agendada', programadaEn: '2026-11-26T16:00:00Z' });
    renderDialog({ kind: 'crear', fecha: DIA });

    await buscarYElegirMaria();
    fireEvent.click(await screen.findByRole('radio', { name: 'Psicología', ...HIDDEN }));
    const umeca = screen.getByRole('checkbox', { name: /Cita obligatoria \(UMECA\)/, ...HIDDEN });
    expect((umeca as HTMLInputElement).checked).toBe(false);
    fireEvent.click(umeca);
    fireEvent.click(screen.getByRole('button', { name: 'Agendar cita', ...HIDDEN }));

    await waitFor(() => expect(crearMock).toHaveBeenCalledWith(expect.objectContaining({ personaId: 'p9', origen: 'umeca' })));
  });
});
