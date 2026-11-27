import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import { AhomeLogo, BrandMark } from '@/shared/ui/BrandMark';

afterEach(cleanup);

describe('BrandMark', () => {
  it('muestra la marca general de la app (isotipo), no el logo de Ahome', () => {
    const { container } = render(<BrandMark size={40} />);
    const wrapper = container.querySelector('.vc-brand-mark');
    expect(wrapper).not.toBeNull();
    expect(wrapper!.getAttribute('aria-hidden')).toBe('true');
    const light = container.querySelector('img.vc-brand-mark__img--light');
    expect(light!.getAttribute('src')).toBe('/logos/app-icon.svg');
    expect(light!.getAttribute('width')).toBe('40');
    expect(light!.getAttribute('height')).toBe('40');
    for (const img of container.querySelectorAll('img')) {
      expect(img.getAttribute('src')).not.toMatch(/ahome/i);
    }
  });

  it('incluye la versión blanca oficial para modo oscuro (el CSS elige cuál mostrar)', () => {
    const { container } = render(<BrandMark size={36} />);
    const dark = container.querySelector('img.vc-brand-mark__img--dark');
    expect(dark!.getAttribute('src')).toBe('/logos/app-icon-white-512.png');
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
