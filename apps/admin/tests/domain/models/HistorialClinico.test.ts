import { describe, expect, it } from 'vitest';
import {
  calcularCambiosVersion,
  camposCambiados,
  puedeEscribirHistorialClinico,
  valorCampoHistorial,
  type HistorialClinicoContenido,
  type HistorialClinicoVersion,
} from '@/domain/models/HistorialClinico';

const BASE: HistorialClinicoContenido = {
  motivoConsulta: 'Ansiedad',
  antecedentesPersonales: null,
  antecedentesFamiliares: 'Red materna',
  tieneAtencionPsicologicaPrevia: false,
  observacionesIniciales: null,
};

function version(partial: Partial<HistorialClinicoVersion>): HistorialClinicoVersion {
  return {
    id: 'v',
    historialClinicoId: 'hc-1',
    fichaId: 'ficha-1',
    version: 1,
    ...BASE,
    camposModificados: [],
    creadoPor: 'emp-1',
    creadoPorNombre: 'Psicóloga',
    creadoEn: '2026-11-27T10:00:00Z',
    ...partial,
  };
}

describe('puedeEscribirHistorialClinico', () => {
  it('solo Psicología escribe', () => {
    expect(puedeEscribirHistorialClinico('psicologia')).toBe(true);
    for (const role of ['titular', 'subdireccion', 'trabajo_social', 'juridico', 'recepcion'] as const) {
      expect(puedeEscribirHistorialClinico(role)).toBe(false);
    }
    expect(puedeEscribirHistorialClinico(undefined)).toBe(false);
  });
});

describe('valorCampoHistorial', () => {
  it('muestra Sí/No, recorta texto y devuelve null si está vacío', () => {
    expect(valorCampoHistorial({ ...BASE, tieneAtencionPsicologicaPrevia: true }, 'tieneAtencionPsicologicaPrevia')).toBe('Sí');
    expect(valorCampoHistorial(BASE, 'tieneAtencionPsicologicaPrevia')).toBe('No');
    expect(valorCampoHistorial({ ...BASE, motivoConsulta: '  Ansiedad  ' }, 'motivoConsulta')).toBe('Ansiedad');
    expect(valorCampoHistorial({ ...BASE, motivoConsulta: '   ' }, 'motivoConsulta')).toBeNull();
    expect(valorCampoHistorial(BASE, 'observacionesIniciales')).toBeNull();
  });
});

describe('camposCambiados', () => {
  it('detecta solo lo que cambió e ignora espacios y null frente a «No»', () => {
    expect(camposCambiados(BASE, { ...BASE, motivoConsulta: ' Ansiedad ' })).toEqual([]);
    expect(
      camposCambiados(
        { ...BASE, tieneAtencionPsicologicaPrevia: null },
        { ...BASE, tieneAtencionPsicologicaPrevia: false },
      ),
    ).toEqual([]);
    expect(
      camposCambiados(BASE, {
        ...BASE,
        motivoConsulta: 'Ansiedad severa',
        observacionesIniciales: 'Llegó acompañada',
        tieneAtencionPsicologicaPrevia: true,
      }),
    ).toEqual(['motivoConsulta', 'tieneAtencionPsicologicaPrevia', 'observacionesIniciales']);
  });

  it('sin historial previo marca los campos con contenido', () => {
    expect(camposCambiados(null, BASE)).toEqual(['motivoConsulta', 'antecedentesFamiliares']);
  });
});

describe('calcularCambiosVersion', () => {
  it('compara contra la versión anterior en el orden de presentación', () => {
    const v1 = version({ version: 1, camposModificados: ['motivoConsulta', 'antecedentesFamiliares'] });
    const v2 = version({
      version: 2,
      motivoConsulta: 'Ansiedad severa',
      tieneAtencionPsicologicaPrevia: true,
      camposModificados: ['tieneAtencionPsicologicaPrevia', 'motivoConsulta'],
    });

    expect(calcularCambiosVersion(v2, v1)).toEqual([
      { campo: 'motivoConsulta', label: 'Motivo de consulta', antes: 'Ansiedad', despues: 'Ansiedad severa' },
      {
        campo: 'tieneAtencionPsicologicaPrevia',
        label: 'Atención psicológica previa',
        antes: 'No',
        despues: 'Sí',
      },
    ]);
  });

  it('el registro inicial no tiene «antes» y un campo borrado queda en null', () => {
    const v1 = version({ camposModificados: ['motivoConsulta'] });
    expect(calcularCambiosVersion(v1, null)).toEqual([
      { campo: 'motivoConsulta', label: 'Motivo de consulta', antes: null, despues: 'Ansiedad' },
    ]);

    const v2 = version({ version: 2, motivoConsulta: null, camposModificados: ['motivoConsulta'] });
    expect(calcularCambiosVersion(v2, v1)[0]).toMatchObject({ antes: 'Ansiedad', despues: null });
  });
});
