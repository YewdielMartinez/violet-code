import { describe, expect, it } from 'vitest';
import {
  detectSearchKind,
  formatFullName,
  isValidCurp,
  normalizeCurp,
} from './Persona';
import { canLookupPreRegistro, mapPreRegistroRow } from './PreRegistroMovil';

describe('Persona (CURP y utilidades de búsqueda)', () => {
  it('normaliza espacios y minúsculas de CURP', () => {
    expect(normalizeCurp('  gala 900512 msl nrr 01 ')).toBe('GALA900512MSLNRR01');
  });

  it('valida el formato oficial de CURP alineado con PostgreSQL', () => {
    expect(isValidCurp('gala900512mslnrr01')).toBe(true);
    expect(isValidCurp('PERL021120MSLNRC09')).toBe(true);
    expect(isValidCurp('GALA900512MSLNRA01')).toBe(false); // vocal en consonantes internas
    expect(isValidCurp('GALA900512XXLNRR01')).toBe(false); // entidad inexistente
    expect(isValidCurp('GALA901312MSLNRR01')).toBe(false); // mes inválido
    expect(isValidCurp('GALA900512')).toBe(false); // longitud incompleta
  });

  it('clasifica búsquedas por CURP, folio o nombre', () => {
    expect(detectSearchKind('GALA900512MSLNRR01')).toBe('curp');
    expect(detectSearchKind('sem-2026-0001')).toBe('folio');
    expect(detectSearchKind('Ana López')).toBe('nombre');
  });

  it('formatea el nombre completo omitiendo apellidos vacíos', () => {
    expect(formatFullName('Ana', 'López', null)).toBe('Ana López');
    expect(formatFullName('Ana María', 'López', 'García')).toBe('Ana María López García');
  });
});

describe('PreRegistroMovil', () => {
  it('restringe consulta de pre-registro a Trabajo Social y Dirección', () => {
    expect(canLookupPreRegistro('trabajo_social')).toBe(true);
    expect(canLookupPreRegistro('titular')).toBe(true);
    expect(canLookupPreRegistro('subdireccion')).toBe(true);
    expect(canLookupPreRegistro('psicologia')).toBe(false);
    expect(canLookupPreRegistro('juridico')).toBe(false);
    expect(canLookupPreRegistro('recepcion')).toBe(false);
    expect(canLookupPreRegistro('umeca')).toBe(false);
  });

  it('mapea filas RPC de buscar_pre_registro_por_curp al modelo de dominio', () => {
    const mapped = mapPreRegistroRow({
      pre_registro_id: 'pre-1',
      curp: ' perl021120mslnrc09 ',
      nombres: 'Sofía ',
      apellido_paterno: ' Pérez',
      apellido_materno: '  ',
      sexo: 'M',
      fecha_nacimiento: '2002-11-20',
      entidad_nacimiento: 'SL',
      celular: '6680000001',
      persona_id: null,
    });

    expect(mapped).toEqual({
      preRegistroId: 'pre-1',
      curp: 'PERL021120MSLNRC09',
      nombres: 'Sofía',
      apellidoPaterno: 'Pérez',
      apellidoMaterno: null,
      nombreCompleto: 'Sofía Pérez',
      sexo: 'M',
      fechaNacimiento: '2002-11-20',
      entidadNacimiento: 'SL',
      celular: '6680000001',
      personaId: null,
    });
  });
});
