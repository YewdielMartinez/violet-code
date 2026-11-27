import { describe, expect, it } from 'vitest';
import { INITIAL_DOMICILIO_INPUT, validateDomicilio } from '@/domain/models/Domicilio';
import {
  EMPTY_APORTANTE,
  INITIAL_ESTUDIO_INPUT,
  validateEstudioSocioeconomico,
} from '@/domain/models/EstudioSocioeconomico';
import {
  INITIAL_FICHA_IDENTIDAD,
  createIdentidadFromPreRegistro,
  validateFichaIdentidad,
} from '@/domain/models/FichaRegistro';

describe('FichaRegistro (validaciones RNF-04 y precarga móvil)', () => {
  it('exige aceptación del Aviso de Privacidad y al menos un servicio solicitado', () => {
    const base = {
      ...INITIAL_FICHA_IDENTIDAD,
      curp: 'GALA900512MSLNRR01',
      nombres: 'Laura',
      apellidoPaterno: 'García',
      estadoCivil: 'soltero' as const,
      ocupacionId: 2,
      escolaridad: 'primaria' as const,
      serviciosSolicitadosAreaIds: [1],
      avisoPrivacidadAceptado: false,
    };
    expect(validateFichaIdentidad(base)).toMatch(/Aviso de Privacidad/i);

    // Estado civil, ocupación y escolaridad son obligatorios.
    expect(validateFichaIdentidad({ ...base, estadoCivil: '' })).toMatch(/estado civil/i);
    expect(validateFichaIdentidad({ ...base, ocupacionId: null })).toMatch(/ocupación/i);
    expect(validateFichaIdentidad({ ...base, escolaridad: '' })).toMatch(/escolaridad/i);

    expect(
      validateFichaIdentidad({
        ...base,
        avisoPrivacidadAceptado: true,
        serviciosSolicitadosAreaIds: [],
      }),
    ).toMatch(/servicio solicitado/i);

    expect(
      validateFichaIdentidad({
        ...base,
        avisoPrivacidadAceptado: true,
      }),
    ).toBeNull();
  });

  it('precarga identidad desde PreRegistroMovil sin perder campos clave', () => {
    const pre = createIdentidadFromPreRegistro({
      preRegistroId: 'pre-1',
      curp: 'PERL021120MSLNRC09',
      nombres: 'Sofía',
      apellidoPaterno: 'Pérez',
      apellidoMaterno: 'López',
      nombreCompleto: 'Sofía Pérez López',
      sexo: 'M',
      fechaNacimiento: '2002-11-20',
      entidadNacimiento: 'SL',
      celular: '6680000001',
      personaId: null,
    });

    expect(pre.curp).toBe('PERL021120MSLNRC09');
    expect(pre.nombres).toBe('Sofía');
    expect(pre.celular).toBe('6680000001');
    expect(pre.avisoPrivacidadAceptado).toBe(true);
  });
});

describe('Domicilio (regla SEPOMEX vs CP foráneo)', () => {
  it('impide combinar asentamientoId local con codigoPostalForaneo', () => {
    expect(
      validateDomicilio({
        ...INITIAL_DOMICILIO_INPUT,
        asentamientoId: 10,
        codigoPostalForaneo: '81200',
        calle: 'Calle Hidalgo',
      }),
    ).toMatch(/No combines/i);
  });

  it('acepta asentamiento SEPOMEX sin CP foráneo o CP foráneo de 5 dígitos sin asentamiento', () => {
    expect(
      validateDomicilio({
        ...INITIAL_DOMICILIO_INPUT,
        asentamientoId: 10,
        calle: 'Calle Hidalgo',
      }),
    ).toBeNull();

    expect(
      validateDomicilio({
        ...INITIAL_DOMICILIO_INPUT,
        asentamientoId: null,
        codigoPostalForaneo: '80000',
        calle: 'Av. Insurgentes',
      }),
    ).toBeNull();
  });
});

describe('EstudioSocioeconomico', () => {
  it('valida rangos de dependientes y campos requeridos de aportantes', () => {
    expect(
      validateEstudioSocioeconomico({
        ...INITIAL_ESTUDIO_INPUT,
        numeroDependientes: '35',
      }),
    ).toMatch(/entre 0 y 30/i);

    expect(
      validateEstudioSocioeconomico({
        ...INITIAL_ESTUDIO_INPUT,
        aportantes: [{ ...EMPTY_APORTANTE, nombre: '' }],
      }),
    ).toMatch(/aportante #1/i);

    expect(
      validateEstudioSocioeconomico({
        ...INITIAL_ESTUDIO_INPUT,
        ingresoMensualPropio: '8500',
        aportantes: [{ ...EMPTY_APORTANTE, nombre: 'Hermana', monto: '4000' }],
      }),
    ).toBeNull();
  });
});
