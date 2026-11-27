import { useId, useMemo, type FormEvent } from 'react';
import { LoadingButton, Select } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/loading-button';
import '@yewdiel21/motion-kit/css/components/select';
import { Icon } from '@/shared/ui/Icon';
import {
  DESCRIPCION_MAX_LENGTH,
  type OrdenProteccionOpcion,
  type TipoDocumento,
} from '../documentosApi';
import type { ChecklistSlotKey } from './documentoGrouping';

interface DocumentoSlotDetailsProps {
  slotKey: ChecklistSlotKey;
  subtiposOtro: TipoDocumento[];
  selectedTipoId: string;
  onSelectTipoId: (id: string) => void;
  ordenes: OrdenProteccionOpcion[];
  ordenesLoading: boolean;
  ordenProteccionId: string;
  onSelectOrdenId: (id: string) => void;
  descripcion: string;
  onChangeDescripcion: (val: string) => void;
  esDescripcionObligatoria: boolean;
  uploading: boolean;
  submitState: 'idle' | 'loading' | 'success' | 'error';
  onSubmitStateChange: (next: 'idle' | 'loading' | 'success' | 'error') => void;
  error: string | null;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
}

const SIN_ORDEN_OPTION = { value: '', label: 'Sin vincular a una orden de protección' };
const LOADING_LABELS = {
  loading: 'Subiendo…',
  success: 'Adjuntado',
  error: 'Revisa los datos',
};

export function DocumentoSlotDetails({
  slotKey,
  subtiposOtro,
  selectedTipoId,
  onSelectTipoId,
  ordenes,
  ordenesLoading,
  ordenProteccionId,
  onSelectOrdenId,
  descripcion,
  onChangeDescripcion,
  esDescripcionObligatoria,
  uploading,
  submitState,
  onSubmitStateChange,
  error,
  onCancel,
  onSubmit,
}: DocumentoSlotDetailsProps) {
  const descripcionId = useId();
  const errorId = useId();

  const subtipoOptions = useMemo(
    () => subtiposOtro.map((tipo) => ({ value: String(tipo.id), label: tipo.nombre })),
    [subtiposOtro],
  );

  const ordenOptions = useMemo(
    () => [SIN_ORDEN_OPTION, ...ordenes.map((ord) => ({ value: ord.id, label: ord.label }))],
    [ordenes],
  );

  const showOrdenSelector =
    ordenes.length > 0 && (slotKey === 'orden_proteccion' || slotKey === 'otro');

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mt-2 grid gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3"
    >
      {slotKey === 'otro' && subtipoOptions.length > 1 ? (
        <div className="grid gap-1">
          <span className="text-xs font-medium text-on-surface">Categoría del documento</span>
          <Select
            label="Categoría del documento"
            options={subtipoOptions}
            value={selectedTipoId}
            disabled={uploading}
            onChange={onSelectTipoId}
          />
        </div>
      ) : null}

      {showOrdenSelector ? (
        <div className="grid gap-1">
          <span className="text-xs font-medium text-on-surface">
            Vincular a orden de protección (opcional)
          </span>
          <Select
            label="Orden de protección"
            placeholder={ordenesLoading ? 'Cargando órdenes…' : 'Sin vincular'}
            options={ordenOptions}
            value={ordenProteccionId}
            disabled={ordenesLoading || uploading}
            onChange={onSelectOrdenId}
          />
        </div>
      ) : null}

      <div className="grid gap-1">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={descripcionId} className="text-xs font-medium text-on-surface">
            {esDescripcionObligatoria
              ? 'Descripción * (obligatoria para «Otro»)'
              : 'Descripción (opcional)'}
          </label>
          <span className="font-mono text-[11px] text-on-surface-variant">
            {descripcion.length}/{DESCRIPCION_MAX_LENGTH}
          </span>
        </div>
        <label className="mk-field w-full">
          <textarea
            id={descripcionId}
            rows={2}
            maxLength={DESCRIPCION_MAX_LENGTH}
            disabled={uploading}
            placeholder={
              esDescripcionObligatoria
                ? 'Especifica qué documento estás adjuntando…'
                : 'Agrega contexto breve si es necesario…'
            }
            value={descripcion}
            onChange={(event) => onChangeDescripcion(event.target.value)}
            aria-required={esDescripcionObligatoria || undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="w-full resize-y"
          />
        </label>
      </div>

      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-status-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className="mk-button mk-button--text mk-button--sm"
          disabled={uploading}
          onClick={onCancel}
        >
          Cancelar
        </button>
        <LoadingButton
          type="submit"
          aria-label="Confirmar carga"
          state={submitState}
          labels={LOADING_LABELS}
          compact={false}
          resetAfter={1400}
          onStateChange={(next) => {
            if (next === 'idle') onSubmitStateChange('idle');
          }}
          className="mk-button mk-button--primary mk-button--sm"
        >
          <Icon name="cloud_upload" />
          <span>Confirmar carga</span>
        </LoadingButton>
      </div>
    </form>
  );
}
