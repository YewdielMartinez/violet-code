import { describe, expect, it } from 'vitest';
import {
  mapAgresorRow,
  mapAsentamientoRow,
  mapCatalogoRow,
  toAgresorInsert,
  toAgresorUpdate,
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
  tiene_consumo_droga: true,
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
      tieneConsumoDroga: true,
      drogas: ['marihuana'],
      especificacionDroga: 'Consumo ocasional',
      especificacionArma: 'Objeto metálico',
      observaciones: 'Antecedentes registrados.',
      activo: true,
      actualizadoEn: '2026-11-25T18:00:00Z',
    });
  });

  it('traduce AgresorInput a Insert limpiando espacios vacíos y respetando reglas condicionales', () => {
    const insert = toAgresorInsert({
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
      tieneConsumoDroga: false,
      drogas: ['marihuana'], // debe anularse porque tieneConsumoDroga es false
      especificacionDroga: 'Detalle',
      especificacionArma: '  ',
      observaciones: '  Seguimiento activo.  ',
    });

    expect(insert).toEqual({
      ficha_id: 'ficha-1',
      nombres: 'Héctor',
      apellido_paterno: 'Montoya',
      apellido_materno: null,
      parentesco_id: 2,
      parentesco_otro: null,
      asentamiento_id: 15,
      codigo_postal: null,
      calle: 'Calle Central',
      numero_exterior: null,
      numero_interior: null,
      referencias: null,
      ocupacion_id: 3,
      ocupacion_otra: null,
      tiene_consumo_droga: false,
      drogas: null,
      especificacion_droga: null,
      especificacion_arma: null,
      observaciones: 'Seguimiento activo.',
    });
  });

  it('traduce AgresorInput a Update preservando código postal manual y campos condicionales activos', () => {
    const update = toAgresorUpdate({
      fichaId: 'ficha-1',
      nombres: 'Héctor',
      asentamientoId: null,
      codigoPostal: ' 81200 ',
      tieneConsumoDroga: true,
      drogas: ['cristal', 'cristal', 'otra'],
      especificacionDroga: '  Policonsumo ',
      especificacionArma: '  Corta ',
    });

    expect(update).toMatchObject({
      nombres: 'Héctor',
      asentamiento_id: null,
      codigo_postal: '81200',
      tiene_consumo_droga: true,
      drogas: ['cristal', 'otra'],
      especificacion_droga: 'Policonsumo',
      especificacion_arma: 'Corta',
    });
    expect('ficha_id' in update).toBe(false);
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
