import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import { AhomeLogo, BrandMark } from '@/shared/ui/BrandMark';

afterEach(cleanup);

describe('BrandMark', () => {
  it('muestra la marca general de la app (isotipo), no el logo de Ahome', () => {
    const { container } = render(<BrandMark size={40} />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('/logos/app-icon.svg');
    expect(img!.getAttribute('src')).not.toMatch(/ahome/i);
    expect(img!.classList.contains('vc-brand-mark')).toBe(true);
    expect(img!.getAttribute('width')).toBe('40');
    expect(img!.getAttribute('height')).toBe('40');
    expect(img!.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('AhomeLogo', () => {
  it('usa el logotipo de Ahome conservando la proporción', () => {
    const { getByAltText } = render(<AhomeLogo size={50} />);
    const img = getByAltText('Municipio de Ahome');
    expect(img!.getAttribute('src')).toBe('/logo-ahome.png');
    expect(img!.getAttribute('height')).toBe('50');
    expect(img.getAttribute('width')).toBe(String(Math.round(50 * (1260 / 408))));
  });
});
