import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DocumentoAdjunto,
  OrdenProteccionOpcion,
  TipoDocumento,
} from '@/domain/models/DocumentoAdjunto';

const {
  useAuthMock,
  listarPorFichaMock,
  listarTiposMock,
  listarOrdenesMock,
  subirMock,
  obtenerUrlFirmadaMock,
  archivarMock,
  toastMock,
  imagePreviewSpy,
} = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  listarPorFichaMock: vi.fn(),
  listarTiposMock: vi.fn(),
  listarOrdenesMock: vi.fn(),
  subirMock: vi.fn(),
  obtenerUrlFirmadaMock: vi.fn(),
  archivarMock: vi.fn(),
  toastMock: vi.fn(),
  imagePreviewSpy: vi.fn(),
}));

vi.mock('@/shared/auth/useAuth', () => ({
  useAuth: useAuthMock,
}));

vi.mock('@/infrastructure/supabase/adapters/SupabaseDocumentoStorageRepository', () => ({
  supabaseDocumentoStorageRepository: {
    listarPorFicha: listarPorFichaMock,
    listarTipos: listarTiposMock,
    listarOrdenesProteccion: listarOrdenesMock,
    subir: subirMock,
    obtenerUrlFirmada: obtenerUrlFirmadaMock,
    archivar: archivarMock,
  },
}));

vi.mock('@yewdiel21/motion-kit/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@yewdiel21/motion-kit/react')>();
  return {
    ...actual,
    toast: toastMock,
    ImagePreview: ({
      images,
      onOpenChange,
    }: {
      images: Array<{ src: string; alt: string }>;
      onOpenChange?: (open: boolean) => void;
    }) => {
      imagePreviewSpy(images);
      return (
        <div data-testid="image-preview-mock">
          <span>{images[0]?.alt}</span>
          <button type="button" onClick={() => onOpenChange?.(false)}>
            Cerrar preview
          </button>
        </div>
      );
    },
  };
});

import { DocumentosAdjuntosPanel } from '@/features/expedientes/DocumentosAdjuntosPanel';

const TIPOS: TipoDocumento[] = [
  { id: 1, clave: 'ine', nombre: 'Copia de la INE' },
  { id: 2, clave: 'foto', nombre: 'Fotografía' },
  { id: 6, clave: 'denuncia', nombre: 'Copia de la denuncia' },
  { id: 7, clave: 'orden_proteccion', nombre: 'Copia de la orden de protección' },
  { id: 9, clave: 'otro', nombre: 'Otro' },
];

const DOC_FOTO: DocumentoAdjunto = {
  id: 'doc-foto-1',
  fichaId: 'ficha-1',
  tipoDocumentoId: 2,
  tipoDocumentoClave: 'foto',
  tipoDocumentoNombre: 'Fotografía',
  ordenProteccionId: null,
  descripcion: null,
  rutaStorage: 'ficha-1/uuid-foto.jpg',
  nombreArchivo: 'foto-usuaria.jpg',
  activo: true,
  creadoEn: '2026-11-26T10:00:00Z',
};

const DOC_PDF: DocumentoAdjunto = {
  id: 'doc-pdf-1',
  fichaId: 'ficha-1',
  tipoDocumentoId: 6,
  tipoDocumentoClave: 'denuncia',
  tipoDocumentoNombre: 'Copia de la denuncia',
  ordenProteccionId: null,
  descripcion: null,
  rutaStorage: 'ficha-1/uuid-denuncia.pdf',
  nombreArchivo: 'denuncia-mp.pdf',
  activo: true,
  creadoEn: '2026-11-26T11:00:00Z',
};

const ORDENES: OrdenProteccionOpcion[] = [
  { id: 'ord-1', label: 'Oficio 123/2026 · Vigente' },
];

function renderPanel(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  useAuthMock.mockReturnValue({
    status: 'authenticated',
    user: { id: 'emp-1', role: 'trabajo_social', areaId: 1 },
  });
  listarPorFichaMock.mockReset().mockResolvedValue([DOC_FOTO, DOC_PDF]);
  listarTiposMock.mockReset().mockResolvedValue(TIPOS);
  listarOrdenesMock.mockReset().mockResolvedValue(ORDENES);
  subirMock.mockReset().mockResolvedValue({
    ...DOC_FOTO,
    id: 'doc-new',
    tipoDocumentoId: 1,
    tipoDocumentoClave: 'ine',
    tipoDocumentoNombre: 'Copia de la INE',
    nombreArchivo: 'ine-frente.png',
  });
  obtenerUrlFirmadaMock.mockReset().mockResolvedValue('https://signed.local/file?token=60s');
  archivarMock.mockReset().mockResolvedValue(undefined);
  toastMock.mockReset();
  imagePreviewSpy.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('DocumentosAdjuntosPanel (flujo inline por checklist sin modales)', () => {
  it('bloquea la vista cuando el rol es recepción o UMECA', () => {
    useAuthMock.mockReturnValue({
      status: 'authenticated',
      user: { id: 'emp-2', role: 'recepcion', areaId: null },
    });

    renderPanel(<DocumentosAdjuntosPanel fichaId="ficha-1" />);
    expect(screen.getByText('Acceso restringido')).toBeTruthy();
    expect(listarPorFichaMock).not.toHaveBeenCalled();
  });

  it('muestra las 5 ranuras del checklist sin diálogo modal de carga y con miniaturas firmadas a 60 s', async () => {
    renderPanel(<DocumentosAdjuntosPanel fichaId="ficha-1" />);

    const slotIne = await screen.findByRole('article', { name: /Ranura de documento: INE/i });
    const slotFoto = screen.getByRole('article', { name: /Ranura de documento: Fotografía/i });
    const slotDenuncia = screen.getByRole('article', { name: /Ranura de documento: Denuncia/i });
    expect(screen.getByRole('article', { name: /Ranura de documento: Copia de orden de protección/i })).toBeTruthy();
    expect(screen.getByRole('article', { name: /Ranura de documento: Otro/i })).toBeTruthy();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(slotIne).getByText('Pendiente')).toBeTruthy();
    expect(within(slotFoto).getByText('Adjuntado')).toBeTruthy();
    expect(within(slotDenuncia).getByText('Adjuntado')).toBeTruthy();

    await waitFor(() => {
      expect(obtenerUrlFirmadaMock).toHaveBeenCalledWith('ficha-1/uuid-foto.jpg', 60);
    });
  });

  it('sube de forma directa e inline al seleccionar un archivo válido en la ranura INE y valida archivos inválidos', async () => {
    renderPanel(<DocumentosAdjuntosPanel fichaId="ficha-1" />);

    const slotIne = await screen.findByRole('article', { name: /Ranura de documento: INE/i });
    const ineInput = slotIne.querySelector<HTMLInputElement>('input[type="file"]');
    expect(ineInput).not.toBeNull();

    // Archivo inválido: extensión/mime no permitido
    const badFile = new File(['abc'], 'script.txt', { type: 'text/plain' });
    fireEvent.change(ineInput!, { target: { files: [badFile] } });
    expect(subirMock).not.toHaveBeenCalled();

    // Archivo válido: sube de inmediato sin abrir diálogo
    const validFile = new File(['png-data'], 'ine-frente.png', { type: 'image/png' });
    fireEvent.change(ineInput!, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(subirMock).toHaveBeenCalledTimes(1);
    });
    expect(subirMock.mock.calls[0]?.[0]).toMatchObject({
      fichaId: 'ficha-1',
      tipoDocumentoId: 1,
      ordenProteccionId: null,
      descripcion: null,
      file: validFile,
    });
  });

  it('expande la descripción obligatoria inline en «Otro» antes de confirmar la carga', async () => {
    renderPanel(<DocumentosAdjuntosPanel fichaId="ficha-1" />);

    const slotOtro = await screen.findByRole('article', { name: /Ranura de documento: Otro/i });
    const otroInput = slotOtro.querySelector<HTMLInputElement>('input[type="file"]');
    expect(otroInput).not.toBeNull();

    const pdfFile = new File(['pdf-bytes'], 'constancia.pdf', { type: 'application/pdf' });
    fireEvent.change(otroInput!, { target: { files: [pdfFile] } });

    const descTextarea = within(slotOtro).getByLabelText(/Descripción \* \(obligatoria/i);
    expect(subirMock).not.toHaveBeenCalled();

    // Intento sin descripción muestra error inline
    fireEvent.click(within(slotOtro).getByRole('button', { name: /Confirmar carga/i }));
    expect(within(slotOtro).getByRole('alert').textContent).toContain('obligatoria');
    expect(subirMock).not.toHaveBeenCalled();

    fireEvent.change(descTextarea, { target: { value: 'Constancia médica de atención' } });
    fireEvent.click(within(slotOtro).getByRole('button', { name: /Confirmar carga/i }));

    await waitFor(() => {
      expect(subirMock).toHaveBeenCalledTimes(1);
    });
    expect(subirMock.mock.calls[0]?.[0]).toMatchObject({
      fichaId: 'ficha-1',
      tipoDocumentoId: 9,
      descripcion: 'Constancia médica de atención',
      file: pdfFile,
    });
  });

  it('ejecuta Ver (ImagePreview), Descargar (signed URL download) y Archivar inline con FuseButton', async () => {
    renderPanel(<DocumentosAdjuntosPanel fichaId="ficha-1" />);

    const slotFoto = await screen.findByRole('article', { name: /Ranura de documento: Fotografía/i });
    await waitFor(() => {
      expect(within(slotFoto).getByAltText('foto-usuaria.jpg')).toBeTruthy();
    });

    fireEvent.click(within(slotFoto).getByRole('button', { name: /^Ver$/i }));
    await waitFor(() => {
      expect(imagePreviewSpy).toHaveBeenCalled();
    });

    fireEvent.click(within(slotFoto).getByRole('button', { name: /Descargar foto-usuaria.jpg/i }));
    await waitFor(() => {
      expect(obtenerUrlFirmadaMock).toHaveBeenCalledWith('ficha-1/uuid-foto.jpg', 60, {
        download: 'foto-usuaria.jpg',
      });
    });

    // Archivar inline con FuseButton split (sin ArchivarDocumentoDialog)
    fireEvent.click(within(slotFoto).getByRole('button', { name: 'Archivar' }));
    const confirmArchiveBtn = await within(slotFoto).findByRole(
      'button',
      { name: /Sí, archivar/i },
      { timeout: 2000 },
    );
    fireEvent.click(confirmArchiveBtn);

    await waitFor(() => {
      expect(archivarMock).toHaveBeenCalledWith('doc-foto-1');
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
