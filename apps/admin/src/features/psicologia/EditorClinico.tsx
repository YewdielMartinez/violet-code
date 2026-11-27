import { useLayoutEffect, useRef, useState } from 'react';
import { RichTextEditor } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/rich-text-editor';
import { LIMITE_TEXTO_CLINICO } from '@/domain/models/HistorialClinico';
import { Icon } from '@/shared/ui/Icon';

const SIN_FORMATO: [] = [];

function textoAHtml(texto: string): string {
  const contenido = document.createElement('div');
  for (const linea of texto.split('\n')) {
    const parrafo = document.createElement('p');
    if (linea) parrafo.textContent = linea;
    else parrafo.append(document.createElement('br'));
    contenido.append(parrafo);
  }
  return contenido.innerHTML;
}

export function unirDictado(texto: string, dictado: string): string {
  return [texto.trimEnd(), dictado.trim()].filter(Boolean).join('\n\n');
}

export function EditorClinico({ label, disabled, texto, onChange, requerido = false, destinoDictado = false, onElegirDestino }: {
  label: string;
  disabled: boolean;
  texto: string;
  onChange: (text: string) => void;
  requerido?: boolean;
  /** Resalta el campo que recibirá la próxima transcripción. */
  destinoDictado?: boolean;
  /** Si existe, muestra un acceso para elegir este campo como destino del dictado. */
  onElegirDestino?: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [manual, setManual] = useState({ texto: '', html: '' });
  useLayoutEffect(() => {
    // Motion-kit habilita spellcheck en el elemento editable. No enviar narrativas al corrector.
    root.current?.querySelector('[role="textbox"]')?.setAttribute('spellcheck', 'false');
  }, [disabled, label]);

  return (
    <div ref={root} className={`grid gap-2 rounded-2xl p-1 transition-shadow ${
      destinoDictado ? 'ring-2 ring-primary/40 ring-offset-2 ring-offset-surface-container-low' : ''
    }`}>
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-on-surface">
          {label}
          {requerido && <span className="ml-1 text-error" aria-hidden="true">*</span>}
        </span>
        {destinoDictado ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-container px-2.5 py-0.5 text-xs font-medium text-on-primary-container">
            <Icon name="mic" className="text-sm" /> Destino del dictado
          </span>
        ) : onElegirDestino && !disabled ? (
          <button type="button" className="mk-button mk-button--text mk-button--sm" onClick={onElegirDestino}
            aria-label={`Dictar en ${label}`}>
            <Icon name="mic" /> Dictar aquí
          </button>
        ) : null}
      </div>
      <RichTextEditor
        label={label}
        // Devolver exactamente el HTML emitido al escribir evita reponer el cursor.
        value={texto === manual.texto ? manual.html : textoAHtml(texto)}
        toolbar={SIN_FORMATO}
        markdown={false}
        readOnly={disabled}
        maxLength={LIMITE_TEXTO_CLINICO}
        onChange={(html, textoManual) => {
          setManual({ texto: textoManual, html });
          onChange(textoManual);
        }}
      />
    </div>
  );
}
