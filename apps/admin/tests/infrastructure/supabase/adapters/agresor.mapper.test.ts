import { describe, expect, it } from 'vitest';
import {
  mapAgresorRow,
  mapAsentamientoRow,
  mapCatalogoRow,
  toGuardarAgresorArgs,
  type AgresorRow,
} from '@/infrastructure/supabase/adapters/agresor.mapper';

const SAMPLE_ROW: AgresorRow = {
  id: '77777777-7777-4777-8777-777777777701',
  ficha_id: '55555555-5555-4555-8555-555555555501',
  nombres: 'Roberto',
  apellido_paterno: 'Salazar',
  apellido_materno: 'Pineda',
  parentesco_id: 3,
  parentesco_otro: null,
  asentamiento_id: 12,
  codigo_postal: null,
  calle: 'Calle Allende',
  numero_exterior: '305',
  numero_interior: 'B',
  referencias: 'Frente al parque',
  ocupacion_id: 2,
  ocupacion_otra: null,
  drogas: ['marihuana', 'valor_invalido' as unknown as 'otra'],
  especificacion_droga: 'Consumo ocasional',
  especificacion_arma: 'Objeto metálico',
  observaciones: 'Antecedentes registrados.',
  activo: true,
  actualizado_en: '2026-11-25T18:00:00Z',
};

describe('agresor.mapper', () => {
  it('traduce una fila snake_case a modelo de dominio camelCase filtrando drogas desconocidas', () => {
    const model = mapAgresorRow(SAMPLE_ROW);

    expect(model).toEqual({
      id: '77777777-7777-4777-8777-777777777701',
      fichaId: '55555555-5555-4555-8555-555555555501',
      nombres: 'Roberto',
      apellidoPaterno: 'Salazar',
      apellidoMaterno: 'Pineda',
      parentescoId: 3,
      parentescoOtro: null,
      asentamientoId: 12,
      codigoPostal: null,
      calle: 'Calle Allende',
      numeroExterior: '305',
      numeroInterior: 'B',
      referencias: 'Frente al parque',
      ocupacionId: 2,
      ocupacionOtra: null,
      drogas: ['marihuana'],
      especificacionDroga: 'Consumo ocasional',
      especificacionArma: 'Objeto metálico',
      observaciones: 'Antecedentes registrados.',
      activo: true,
      actualizadoEn: '2026-11-25T18:00:00Z',
    });
  });

  it('traduce AgresorInput a args de guardar_agresor al crear limpiando espacios vacíos y respetando reglas condicionales', () => {
    const args = toGuardarAgresorArgs({
      fichaId: 'ficha-1',
      nombres: '  Héctor  ',
      apellidoPaterno: '  Montoya ',
      apellidoMaterno: '   ',
      parentescoId: 2,
      parentescoOtro: '  ',
      asentamientoId: 15,
      codigoPostal: '81200', // debe anularse porque asentamientoId tiene valor
      calle: '  Calle Central ',
      numeroExterior: '',
      numeroInterior: '',
      referencias: null,
      ocupacionId: 3,
      ocupacionOtra: '',
      drogas: ['no_consume'],
      especificacionDroga: 'Detalle', // sin «Otra» se descarta
      especificacionArma: '  ',
      observaciones: '  Seguimiento activo.  ',
    });

    expect(args).toEqual({
      p_agresor_id: undefined,
      p_ficha_id: 'ficha-1',
      p_actualizado_en: undefined,
      p_nombres: 'Héctor',
      p_apellido_paterno: 'Montoya',
      p_apellido_materno: undefined,
      p_parentesco_id: 2,
      p_parentesco_otro: undefined,
      p_asentamiento_id: 15,
      p_codigo_postal: undefined,
      p_calle: 'Calle Central',
      p_numero_exterior: undefined,
      p_numero_interior: undefined,
      p_referencias: undefined,
      p_ocupacion_id: 3,
      p_ocupacion_otra: undefined,
      p_drogas: ['no_consume'],
      p_especificacion_droga: undefined,
      p_especificacion_arma: undefined,
      p_observaciones: 'Seguimiento activo.',
    });
  });

  it('traduce AgresorInput a args de guardar_agresor al editar preservando CP manual y bloqueo optimista', () => {
    const args = toGuardarAgresorArgs(
      {
        fichaId: 'ficha-1',
        actualizadoEnEsperado: '2026-11-26T10:00:00Z',
        nombres: 'Héctor',
        asentamientoId: null,
        codigoPostal: ' 81200 ',
        drogas: ['cristal', 'cristal', 'otra'],
        especificacionDroga: '  Policonsumo ',
        especificacionArma: '  Corta ',
      },
      'agresor-1',
    );

    expect(args).toMatchObject({
      p_agresor_id: 'agresor-1',
      p_actualizado_en: '2026-11-26T10:00:00Z',
      p_nombres: 'Héctor',
      p_codigo_postal: '81200',
      p_drogas: ['cristal', 'otra'],
      p_especificacion_droga: 'Policonsumo',
      p_especificacion_arma: 'Corta',
    });
    expect(args.p_ficha_id).toBeUndefined();
  });

  it('al editar, una selección vacía de drogas limpia el valor guardado (opcional) y sin dato no lo toca', () => {
    const limpiar = toGuardarAgresorArgs(
      { fichaId: 'ficha-1', nombres: 'Héctor', drogas: [], especificacionDroga: '' },
      'agresor-1',
    );
    expect(limpiar.p_drogas).toEqual([]);
    expect(limpiar.p_especificacion_droga).toBe('');

    const noTocar = toGuardarAgresorArgs({ fichaId: 'ficha-1', nombres: 'Héctor' }, 'agresor-1');
    expect(noTocar.p_drogas).toBeUndefined();
    expect(noTocar.p_especificacion_droga).toBeUndefined();

    const crear = toGuardarAgresorArgs({ fichaId: 'ficha-1', nombres: 'Héctor', drogas: [] });
    expect(crear.p_drogas).toBeUndefined();
  });

  it('descarta la especificación si no se seleccionó «Otra» y deja «No consume» exclusivo', () => {
    const args = toGuardarAgresorArgs({
      fichaId: 'ficha-1',
      nombres: 'Héctor',
      drogas: ['no_consume', 'cristal'],
      especificacionDroga: 'x',
    });
    expect(args.p_drogas).toEqual(['cristal']);
    expect(args.p_especificacion_droga).toBeUndefined();
  });

  it('mapea filas de catálogos y asentamientos SEPOMEX', () => {
    expect(mapCatalogoRow({ id: 1, clave: 'pareja', nombre: 'Pareja' })).toEqual({
      id: 1,
      clave: 'pareja',
      nombre: 'Pareja',
    });

    expect(
      mapAsentamientoRow({
        id: 42,
        nombre: 'Los Mochis Centro',
        tipo_asentamiento: 'Colonia',
        codigo_postal: '81200',
        localidad: 'Los Mochis',
      }),
    ).toEqual({
      id: 42,
      nombre: 'Los Mochis Centro',
      tipoAsentamiento: 'Colonia',
      codigoPostal: '81200',
      localidad: 'Los Mochis',
    });
  });
});
