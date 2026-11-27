import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorClinico, unirDictado } from '@/features/psicologia/EditorClinico';

afterEach(cleanup);

describe('editor clínico y dictado', () => {
  it('anexa el dictado como texto sin sustituir la nota escrita ni interpretar HTML', () => {
    const onChange = vi.fn();
    const inicial = 'Nota sintética escrita.';
    const texto = unirDictado(inicial, ' <strong>Texto sintético dictado.</strong> ');
    expect(texto).toBe(`${inicial}\n\n<strong>Texto sintético dictado.</strong>`);

    const { rerender } = render(<EditorClinico label="Motivo" texto={inicial} disabled={false} onChange={onChange} />);
    rerender(<EditorClinico label="Motivo" texto={texto} disabled={false} onChange={onChange} />);
    const editor = screen.getByRole('textbox', { name: 'Motivo' });
    expect(editor.textContent).toContain(inicial);
    expect(editor.textContent).toContain('<strong>Texto sintético dictado.</strong>');
    expect(editor.querySelector('strong')).toBeNull();
    expect(editor.getAttribute('spellcheck')).toBe('false');

    rerender(<EditorClinico label="Motivo" texto={texto} disabled onChange={onChange} />);
    expect(screen.getByRole('textbox', { name: 'Motivo' }).textContent).toContain('Texto sintético dictado.');
  });

  it('sigue aceptando escritura manual después de incorporar un dictado', () => {
    const onChange = vi.fn();
    render(<EditorClinico label="Motivo" texto="Texto sintético dictado." disabled={false} onChange={onChange} />);
    const editor = screen.getByRole('textbox', { name: 'Motivo' });
    editor.firstElementChild!.textContent = 'Texto sintético corregido.';
    fireEvent.input(editor);
    expect(onChange).toHaveBeenLastCalledWith('Texto sintético corregido.');
  });
});
