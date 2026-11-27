import { memo, useState } from 'react';
import { toast } from '@yewdiel21/motion-kit/react';
import {
  NOTA_PRIVADA_MAX_LENGTH,
  validateNotaPrivada,
  type NotaPrivada,
} from '@/domain/models/NotaPrivada';
import { Icon } from '@/shared/ui/Icon';
import { traducirErrorIntervencion, useActualizarNotaPrivada, useArchivarNotaPrivada } from './api';
import { formatFechaHora } from './formatters';

interface Props {
  nota: NotaPrivada;
  fichaId: string;
  readOnly?: boolean;
}

/** Una nota del área con edición en línea y archivado lógico (sin borrado físico). */
export const NotaPrivadaItem = memo(function NotaPrivadaItem({ nota, fichaId, readOnly = false }: Props) {
  const [editando, setEditando] = useState(false);
  const [confirmarArchivo, setConfirmarArchivo] = useState(false);
  const [borrador, setBorrador] = useState(nota.contenido);
  const actualizar = useActualizarNotaPrivada(fichaId);
  const archivar = useArchivarNotaPrivada(fichaId);
  const busy = actualizar.isPending || archivar.isPending;

  async function guardar() {
    const error = validateNotaPrivada(borrador);
    if (error) {
      toast(error, { tone: 'error' });
      return;
    }
    try {
      await actualizar.mutateAsync({ id: nota.id, contenido: borrador });
      setEditando(false);
      toast('Nota actualizada.', { tone: 'success' });
    } catch (err) {
      toast(traducirErrorIntervencion(err, 'No se pudo actualizar la nota.'), { tone: 'error' });
    }
  }

  async function archivarNota() {
    try {
      await archivar.mutateAsync(nota.id);
      toast('Nota archivada.', { tone: 'success' });
    } catch (err) {
      setConfirmarArchivo(false);
      toast(traducirErrorIntervencion(err, 'No se pudo archivar la nota.'), { tone: 'error' });
    }
  }

  const editada = nota.actualizadoEn !== nota.creadoEn;

  return (
    <li className="grid gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant">
        <div className="flex flex-wrap items-center gap-2">
          {readOnly && nota.areaNombre ? (
            <span className="inline-flex items-center rounded-full bg-secondary-container px-2.5 py-0.5 text-xs font-medium text-on-secondary-container">
              {nota.areaNombre}
            </span>
          ) : null}
          <span>
            {formatFechaHora(nota.creadoEn)}
            {editada ? ` · editada ${formatFechaHora(nota.actualizadoEn)}` : ''}
          </span>
        </div>
        {!readOnly && !editando ? (
          <div className="flex gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setBorrador(nota.contenido);
                setEditando(true);
              }}
              className="mk-button mk-button--text mk-button--sm"
            >
              <Icon name="edit" className="text-base" />
              Editar
            </button>
            {confirmarArchivo ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void archivarNota()}
                className="mk-button mk-button--tonal mk-button--sm"
              >
                ¿Archivar? Confirmar
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmarArchivo(true)}
                className="mk-button mk-button--text mk-button--sm"
              >
                <Icon name="archive" className="text-base" />
                Archivar
              </button>
            )}
          </div>
        ) : null}
      </div>

      {editando ? (
        <div className="grid gap-2">
          <textarea
            aria-label="Editar nota"
            rows={3}
            maxLength={NOTA_PRIVADA_MAX_LENGTH}
            value={borrador}
            disabled={busy}
            onChange={(e) => setBorrador(e.target.value)}
            className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditando(false)}
              className="mk-button mk-button--text mk-button--sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void guardar()}
              className="mk-button mk-button--filled mk-button--sm"
            >
              Guardar
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm whitespace-pre-wrap text-on-surface">{nota.contenido}</p>
      )}
    </li>
  );
});
