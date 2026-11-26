import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Attachment,
  LoadingButton,
  Select,
  toast,
  type AttachmentProps,
  type AttachmentUpload,
} from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/attachment';
import '@yewdiel21/motion-kit/css/components/select';
import '@yewdiel21/motion-kit/css/components/loading-button';
import { Icon } from '@/shared/ui/Icon';
import {
  DESCRIPCION_MAX_LENGTH,
  TAMANO_MAXIMO_BYTES,
  useSubirDocumento,
  validarArchivo,
  validarDocumento,
  type OrdenProteccionOpcion,
  type TipoDocumento,
} from './documentosApi';

interface SelectedAttachment {
  id: string;
  file: File;
}

interface DocumentoUploadFormProps {
  fichaId: string;
  tipos: TipoDocumento[];
  tiposLoading: boolean;
  ordenes: OrdenProteccionOpcion[];
  ordenesLoading: boolean;
}

const ACCEPT_ARCHIVOS = 'image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf';

const ATTACHMENT_LABELS: NonNullable<AttachmentProps['labels']> = {
  choose: 'Seleccionar archivo',
  drop: 'Arrastra una imagen JPG/PNG o un PDF aquí',
  remove: 'Quitar archivo',
  list: 'Archivo listo para adjuntar',
  uploading: 'Subiendo…',
  complete: 'Adjuntado',
  error: 'Error al subir',
};

const LOADING_BUTTON_LABELS = {
  loading: 'Subiendo…',
  success: 'Adjuntado',
  error: 'Error',
};

const SIN_ORDEN_OPTION = { value: '', label: 'Sin vincular a una orden de protección' };

export function DocumentoUploadForm({
  fichaId,
  tipos,
  tiposLoading,
  ordenes,
  ordenesLoading,
}: DocumentoUploadFormProps) {
  const descripcionId = useId();
  const errorId = useId();
  const attachmentRef: NonNullable<AttachmentProps['instanceRef']> = useRef(null);

  const [selected, setSelected] = useState<SelectedAttachment | null>(null);
  const [uploadState, setUploadState] = useState<AttachmentUpload | null>(null);
  const [tipoDocumentoId, setTipoDocumentoId] = useState('');
  const [ordenProteccionId, setOrdenProteccionId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const subirMutation = useSubirDocumento(fichaId);

  const tipoOptions = useMemo(
    () => tipos.map((tipo) => ({ value: String(tipo.id), label: tipo.nombre })),
    [tipos],
  );

  const ordenOptions = useMemo(
    () => [SIN_ORDEN_OPTION, ...ordenes.map((ord) => ({ value: ord.id, label: ord.label }))],
    [ordenes],
  );

  const selectedTipo = useMemo(
    () => tipos.find((tipo) => String(tipo.id) === tipoDocumentoId) ?? null,
    [tipos, tipoDocumentoId],
  );

  const esTipoOtro = selectedTipo?.clave === 'otro';

  const uploads = useMemo<Record<string, AttachmentUpload> | undefined>(() => {
    if (!selected || !uploadState) return undefined;
    return { [selected.id]: uploadState };
  }, [selected, uploadState]);

  function handleFiles(added: Parameters<NonNullable<AttachmentProps['onFiles']>>[0]) {
    const first = added[0];
    if (!first?.file) return;

    const validationMessage = validarArchivo(first.file);
    if (validationMessage) {
      attachmentRef.current?.remove(first.id);
      setSelected(null);
      setUploadState(null);
      setFormError(validationMessage);
      toast(validationMessage, { tone: 'error' });
      return;
    }

    setSelected({ id: first.id, file: first.file });
    setUploadState(null);
    setFormError(null);
  }

  function handleRemove() {
    setSelected(null);
    setUploadState(null);
    setFormError(null);
  }

  function handleReject(rejections: Parameters<NonNullable<AttachmentProps['onReject']>>[0]) {
    const first = rejections[0];
    if (!first) return;
    const message =
      validarArchivo(first.file) ??
      'El archivo no cumple con el formato permitido (JPG, PNG o PDF, máximo 10 MB).';
    setFormError(message);
    toast(message, { tone: 'error' });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const parsedTipoId = Number(tipoDocumentoId);
    const error = validarDocumento({
      tipoDocumentoId: Number.isFinite(parsedTipoId) ? parsedTipoId : null,
      tipoDocumentoClave: selectedTipo?.clave ?? null,
      descripcion,
      file: selected?.file ?? null,
    });

    if (error) {
      setFormError(error);
      return;
    }

    if (!selected) return;

    setFormError(null);
    setUploadState({ progress: 5, status: 'uploading' });

    try {
      await subirMutation.mutateAsync({
        input: {
          fichaId,
          tipoDocumentoId: parsedTipoId,
          ordenProteccionId: ordenProteccionId || null,
          descripcion: descripcion.trim() || null,
          file: selected.file,
        },
        onProgress: (progress) => {
          setUploadState({
            progress,
            status: progress >= 100 ? 'complete' : 'uploading',
          });
        },
      });

      attachmentRef.current?.clear();
      setSelected(null);
      setUploadState(null);
      setTipoDocumentoId('');
      setOrdenProteccionId('');
      setDescripcion('');
      setFormError(null);
      toast('Documento adjuntado al expediente.', { tone: 'success' });
    } catch (err) {
      setUploadState({ progress: 0, status: 'error' });
      const message =
        err instanceof Error ? err.message : 'No se pudo adjuntar el documento. Intenta de nuevo.';
      setFormError(message);
      toast(message, { tone: 'error' });
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="grid gap-4 rounded-2xl border border-outline-variant bg-surface-container-low p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-on-surface">Adjuntar documento</h3>
        <span className="text-xs text-on-surface-variant">JPG, PNG o PDF · Máx. 10 MB</span>
      </div>

      <Attachment
        accept={ACCEPT_ARCHIVOS}
        multiple={false}
        maxFiles={1}
        maxSize={TAMANO_MAXIMO_BYTES}
        disabled={subirMutation.isPending}
        hint="Solo imágenes JPG/PNG o documentos PDF de hasta 10 MB."
        labels={ATTACHMENT_LABELS}
        uploads={uploads}
        instanceRef={attachmentRef}
        onFiles={handleFiles}
        onRemove={handleRemove}
        onReject={handleReject}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-on-surface">Tipo de documento *</span>
          <Select
            label="Tipo de documento"
            placeholder={tiposLoading ? 'Cargando catálogo…' : 'Selecciona un tipo…'}
            options={tipoOptions}
            value={tipoDocumentoId}
            disabled={tiposLoading || subirMutation.isPending}
            onChange={(value) => {
              setTipoDocumentoId(value);
              setFormError(null);
            }}
          />
        </div>

        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-on-surface">
            Orden de protección (opcional)
          </span>
          <Select
            label="Orden de protección"
            placeholder={
              ordenesLoading
                ? 'Cargando órdenes…'
                : ordenes.length === 0
                  ? 'Sin órdenes activas en esta ficha'
                  : 'Sin vincular'
            }
            options={ordenOptions}
            value={ordenProteccionId}
            disabled={ordenesLoading || ordenes.length === 0 || subirMutation.isPending}
            onChange={(value) => setOrdenProteccionId(value)}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={descripcionId} className="text-xs font-medium text-on-surface">
            {esTipoOtro ? 'Descripción * (obligatoria para «Otro»)' : 'Descripción (opcional)'}
          </label>
          <span className="font-mono text-xs text-on-surface-variant">
            {descripcion.length}/{DESCRIPCION_MAX_LENGTH}
          </span>
        </div>
        <label className="mk-field w-full">
          <textarea
            id={descripcionId}
            rows={2}
            maxLength={DESCRIPCION_MAX_LENGTH}
            disabled={subirMutation.isPending}
            placeholder={
              esTipoOtro
                ? 'Especifica qué documento estás adjuntando…'
                : 'Agrega contexto breve si es necesario…'
            }
            value={descripcion}
            onChange={(event) => {
              setDescripcion(event.target.value);
              setFormError(null);
            }}
            aria-required={esTipoOtro || undefined}
            aria-invalid={formError ? true : undefined}
            aria-describedby={formError ? errorId : undefined}
            className="w-full resize-y"
          />
        </label>
      </div>

      {formError ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-status-danger">
          {formError}
        </p>
      ) : null}

      <div className="flex justify-end">
        <LoadingButton
          type="submit"
          state={subirMutation.isPending ? 'loading' : 'idle'}
          labels={LOADING_BUTTON_LABELS}
          compact={false}
          disabled={subirMutation.isPending}
          className="mk-button mk-button--filled"
        >
          <Icon name="attach_file" />
          <span className="ml-1.5">Adjuntar</span>
        </LoadingButton>
      </div>
    </form>
  );
}
