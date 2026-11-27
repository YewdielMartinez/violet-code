import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DescargaWhisper } from '@/features/dictado-voz/DescargaWhisper';

afterEach(cleanup);

describe('progreso visible de Whisper', () => {
  it('solo anuncia descargas mientras hay archivos en transferencia', () => {
    const { rerender } = render(<DescargaWhisper archivos={[]} />);
    expect(screen.getByRole('status').textContent).toContain('Preparando Whisper');
    expect(screen.queryByRole('list')).toBeNull();

    rerender(<DescargaWhisper archivos={[
      { nombre: 'encoder.onnx', fase: 'descargando', recibidos: 20_000_000, total: 80_000_000 },
      { nombre: 'decoder.onnx', fase: 'descargando', recibidos: 9_000, total: null },
      { nombre: 'config.json', fase: 'listo', recibidos: 400, total: 400 },
    ]} />);
    expect(screen.getByRole('status').textContent).toContain('Descargando');
    expect(screen.getByText('20 MB de 80 MB')).toBeTruthy();
    expect(screen.getByText('9 kB recibidos')).toBeTruthy();
    expect(screen.getByText('Descargado · 400 B')).toBeTruthy();
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);

    rerender(<DescargaWhisper archivos={[{ nombre: 'encoder.onnx', fase: 'listo', recibidos: 80_000_000, total: 80_000_000 }]} />);
    expect(screen.getByRole('status').textContent).toContain('Preparando Whisper');
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
