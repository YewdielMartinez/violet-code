import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DictadoVozControl } from '@/features/psicologia/DictadoVozControl';
import type { useSpeechDictation } from '@/features/psicologia/useSpeechDictation';

afterEach(cleanup);

type Dictado = ReturnType<typeof useSpeechDictation>;

function dictadoFalso(estado: Dictado['estado'], extra: Partial<Dictado> = {}): Dictado {
  return {
    estado,
    disponible: true,
    activo: estado.tipo !== 'inactivo' && estado.tipo !== 'error',
    iniciar: vi.fn(async () => {}),
    detener: vi.fn(),
    descartar: vi.fn(),
    ...extra,
  };
}

describe('control de dictado por voz', () => {
  it('muestra siempre el recordatorio de no dictar CURP ni nombres propios (RF-12.1)', () => {
    render(<DictadoVozControl dictado={dictadoFalso({ tipo: 'inactivo' })} disabled={false} onInsertar={vi.fn()} />);
    const boton = screen.getByRole('button', { name: /Iniciar dictado/ });
    const aviso = document.getElementById(boton.getAttribute('aria-describedby')!);
    expect(aviso?.textContent).toContain('No dictes CURP ni nombres propios');
  });

  it('inserta la transcripción revisada en el campo destino y la descarta', () => {
    const onInsertar = vi.fn();
    const dictado = dictadoFalso({ tipo: 'revision', texto: 'Texto sintético' });
    render(<DictadoVozControl dictado={dictado} disabled={false} destinoLabel="Motivo de consulta" onInsertar={onInsertar} />);
    expect(screen.getByText(/«Motivo de consulta»/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Añadir al campo/ }));
    expect(onInsertar).toHaveBeenCalledWith('Texto sintético');
    expect(dictado.descartar).toHaveBeenCalledTimes(1);
  });
});
