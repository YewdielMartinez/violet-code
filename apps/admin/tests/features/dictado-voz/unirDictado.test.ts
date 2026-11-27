import { describe, expect, it } from 'vitest';
import { unirDictado } from '@/features/dictado-voz/unirDictado';

describe('unirDictado', () => {
  it('anexa la transcripción sin reemplazar el texto escrito', () => {
    expect(unirDictado('Nota sintética escrita.  ', '  Texto sintético dictado. ')).toEqual({
      texto: 'Nota sintética escrita.\n\nTexto sintético dictado.',
      recortado: false,
    });
  });

  it('usa solo la transcripción cuando el campo está vacío', () => {
    expect(unirDictado('', 'Texto sintético dictado.').texto).toBe('Texto sintético dictado.');
  });

  it('recorta al límite del campo y lo informa', () => {
    expect(unirDictado('abc', 'defgh', 7)).toEqual({ texto: 'abc\n\nde', recortado: true });
  });
});
