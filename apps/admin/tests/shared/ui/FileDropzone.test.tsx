import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import { FILE_DROPZONE_HINT, FileDropzone } from '@/shared/ui/FileDropzone';

afterEach(cleanup);

describe('FileDropzone', () => {
  it('muestra los formatos y el peso una sola vez', () => {
    const { container } = render(
      <FileDropzone labels={{ choose: 'Adjuntar copia (opcional)' }} accept=".pdf" />,
    );
    const text = container.querySelector('[data-mk-attachment-drop]')!.textContent ?? '';
    expect(text).toContain('Adjuntar copia (opcional)');
    expect(text.match(/PDF/g)).toHaveLength(1);
    expect(text.match(/10 MB/g)).toHaveLength(1);
    expect(container.querySelector('small')?.textContent).toBe(FILE_DROPZONE_HINT);
  });

  it('aplica las clases del tema y la variante compacta', () => {
    const { container } = render(<FileDropzone compact className="extra" />);
    const root = container.firstElementChild!;
    expect(root.classList.contains('mk-attachment')).toBe(true);
    expect(root.classList.contains('vc-dropzone')).toBe(true);
    expect(root.classList.contains('vc-dropzone--compact')).toBe(true);
    expect(root.classList.contains('extra')).toBe(true);
  });
});
