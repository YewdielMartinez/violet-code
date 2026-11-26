import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Attachment,
  Dialog,
  LoadingButton,
  Select,
  toast,
  type AttachmentProps,
  type AttachmentUpload,
} from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/attachment';
import '@yewdiel21/motion-kit/css/components/loading-button';
import '@yewdiel21/motion-kit/css/components/select';
import {
  AUTORIDAD_EMISORA_MAX_LENGTH,
  ESTADO_ORDEN_LABELS,
  ESTADOS_ORDEN_PROTECCION,
  NUMERO_OFICIO_MAX_LENGTH,
  fechaHoyLocalMazatlan,
  useActualizarOrdenProteccion,
  useCrearOrdenProteccion,
  useSubirCopiaOrden,
  useTiposDocumentoOrden,
  validarArchivo,
  validarOrdenProteccion,
  type EstadoOrdenProteccion,
  type OrdenProteccion,
  type OrdenProteccionInput,
  type OrdenProteccionValidationField,
} from './ordenesApi';

export interface AgresorOption {
  id: string;
  nombre: string;
}

export interface OrdenProteccionFormProps {
  fichaId: string;
  orden?: OrdenProteccion | null;
  agresores: readonly AgresorOption[];
  onCancel: () => void;
  onSuccess: () => void;
}

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

const ACCEPT_ARCHIVOS = 'image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf';

const ESTADO_OPTIONS = ESTADOS_ORDEN_PROTECCION.map((estado) => ({
  value: estado,
  label: ESTADO_ORDEN_LABELS[estado],
}));

const SIN_AGRESOR_OPTION = { value: '', label: 'Sin vincular a persona agresora' };

const ATTACHMENT_LABELS: NonNullable<AttachmentProps['labels']> = {
  choose: 'Adjuntar copia (opcional)',
  drop: 'o arrastra JPG, PNG o PDF (máx. 10 MB)',
  remove: 'Quitar archivo',
  list: 'Copia lista para subir',
  uploading: 'Subiendo copia…',
  complete: 'Copia adjuntada',
  error: 'Error al subir copia',
};

const LOADING_LABELS = {
  loading: 'Guardando…',
  success: 'Orden guardada',
  error: 'Revisa los datos',
};

/**
 * Formulario de alta y edición de Orden de Protección (`RF-17`, `RN-17`).
 * Permite vincular opcionalmente a una persona agresora de la ficha y adjuntar
 * la copia oficial en el bucket privado `documentos` usando el puerto existente.
 */
export function OrdenProteccionForm({
  fichaId,
  orden,
  agresores,
  onCancel,
  onSuccess,
}: OrdenProteccionFormProps) {
  const oficioId = useId();
  const autoridadId = useId();
  const emisionId = useId();
  const vigenciaId = useId();
  const attachmentRef: NonNullable<AttachmentProps['instanceRef']> = useRef(null);
  const closeTimerRef = useRef<number | null>(null);

  const [numeroOficio, setNumeroOficio] = useState(orden?.numeroOficio ?? '');
  const [autoridadEmisora, setAutoridadEmisora] = useState(orden?.autoridadEmisora ?? '');
  const [fechaEmision, setFechaEmision] = useState(
    orden?.fechaEmision ?? fechaHoyLocalMazatlan(),
  );
  const [fechaVigencia, setFechaVigencia] = useState(orden?.fechaVigencia ?? '');
  const [estado, setEstado] = useState<EstadoOrdenProteccion>(orden?.estado ?? 'vigente');
  const [agresorId, setAgresorId] = useState(orden?.agresorId ?? '');
  const [selectedFile, setSelectedFile] = useState<{ id: string; file: File } | null>(null);
  const [uploadState, setUploadState] = useState<AttachmentUpload | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<OrdenProteccionValidationField, string>>
  >({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');

  const crearMutation = useCrearOrdenProteccion(fichaId);
  const actualizarMutation = useActualizarOrdenProteccion(fichaId);
  const subirCopiaMutation = useSubirCopiaOrden(fichaId);
  const tiposQuery = useTiposDocumentoOrden(true);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const agresorOptions = useMemo(
    () => [SIN_AGRESOR_OPTION, ...agresores.map((a) => ({ value: a.id, label: a.nombre }))],
    [agresores],
  );

  const tipoOrdenId = useMemo(() => {
    const tipos = tiposQuery.data ?? [];
    const exacto = tipos.find((t) => t.clave === 'orden_proteccion');
    const otro = tipos.find((t) => t.clave === 'otro');
    return exacto?.id ?? otro?.id ?? tipos[0]?.id ?? null;
  }, [tiposQuery.data]);

  const uploads = useMemo<Record<string, AttachmentUpload> | undefined>(() => {
    if (!selectedFile || !uploadState) return undefined;
    return { [selectedFile.id]: uploadState };
  }, [selectedFile, uploadState]);

  function handleFiles(added: Parameters<NonNullable<AttachmentProps['onFiles']>>[0]) {
    const first = added[0];
    if (!first?.file) return;
    const err = validarArchivo(first.file);
    if (err) {
      attachmentRef.current?.remove(first.id);
      setSelectedFile(null);
      setUploadState(null);
      setFileError(err);
      toast(err, { tone: 'error' });
      return;
    }
    setSelectedFile({ id: first.id, file: first.file });
    setUploadState(null);
    setFileError(null);
  }

  function handleReject(rejections: Parameters<NonNullable<AttachmentProps['onReject']>>[0]) {
    const first = rejections[0];
    if (!first) return;
    const msg =
      validarArchivo(first.file) ?? 'El archivo no cumple el formato (JPG/PNG/PDF) o supera 10 MB.';
    setFileError(msg);
    toast(msg, { tone: 'error' });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: OrdenProteccionInput = {
      fichaId,
      agresorId: agresorId || null,
      numeroOficio,
      autoridadEmisora,
      fechaEmision,
      fechaVigencia: fechaVigencia || null,
      estado,
      actualizadoEnEsperado: orden?.actualizadoEn,
    };

    const validacion = validarOrdenProteccion(input);
    if (!validacion.valido) {
      setFieldErrors(validacion.errores);
      setSubmitState('error');
      const primerError = Object.values(validacion.errores)[0] ?? 'Revisa los campos marcados.';
      toast(primerError, { tone: 'error' });
      return;
    }

    if (selectedFile) {
      const errArchivo = validarArchivo(selectedFile.file);
      if (errArchivo) {
        setFileError(errArchivo);
        setSubmitState('error');
        toast(errArchivo, { tone: 'error' });
        return;
      }
      if (!tipoOrdenId) {
        const msg = 'No se encontró el catálogo de tipos de documento para adjuntar la copia.';
        setFileError(msg);
        setSubmitState('error');
        toast(msg, { tone: 'error' });
        return;
      }
    }

    setFieldErrors({});
    setFileError(null);
    setSubmitState('loading');

    let saved: OrdenProteccion;
    try {
      saved = orden
        ? await actualizarMutation.mutateAsync({ id: orden.id, input })
        : await crearMutation.mutateAsync(input);
    } catch (err) {
      setSubmitState('error');
      toast(
        err instanceof Error ? err.message : 'No se pudo guardar la orden de protección.',
        { tone: 'error' },
      );
      return;
    }

    if (selectedFile && tipoOrdenId) {
      setUploadState({ progress: 10, status: 'uploading' });
      try {
        await subirCopiaMutation.mutateAsync({
          input: {
            fichaId,
            tipoDocumentoId: tipoOrdenId,
            ordenProteccionId: saved.id,
            descripcion: `Copia de orden de protección · Oficio ${saved.numeroOficio ?? ''}`.trim(),
            file: selectedFile.file,
          },
          onProgress: (pct) => {
            setUploadState({
              progress: pct,
              status: pct >= 100 ? 'complete' : 'uploading',
            });
          },
        });
        setUploadState({ progress: 100, status: 'complete' });
      } catch (err) {
        setUploadState({ progress: 0, status: 'error' });
        toast(
          `Orden guardada, pero no se pudo adjuntar la copia: ${
            err instanceof Error ? err.message : 'error de almacenamiento'
          }`,
          { tone: 'error' },
        );
        setSubmitState('success');
        onSuccess();
        return;
      }
    }

    setSubmitState('success');
    toast(
      orden ? 'Orden de protección actualizada.' : 'Orden de protección registrada.',
      { tone: 'success' },
    );

    closeTimerRef.current = window.setTimeout(() => {
      onSuccess();
    }, 280);
  }

  const isBusy = submitState === 'loading';

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate>
      <Dialog.Body className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={oficioId} className="mb-1.5 block text-sm font-medium text-on-surface">
              Número de oficio *
            </label>
            <input
              id={oficioId}
              type="text"
              maxLength={NUMERO_OFICIO_MAX_LENGTH}
              required
              disabled={isBusy}
              value={numeroOficio}
              onChange={(e) => setNumeroOficio(e.target.value)}
              placeholder="Ej. JUZ-FAM-2026-0148"
              aria-invalid={Boolean(fieldErrors.numeroOficio)}
              className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
            />
            {fieldErrors.numeroOficio ? (
              <p className="mt-1 text-xs text-status-danger">{fieldErrors.numeroOficio}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor={autoridadId} className="mb-1.5 block text-sm font-medium text-on-surface">
              Autoridad emisora *
            </label>
            <input
              id={autoridadId}
              type="text"
              maxLength={AUTORIDAD_EMISORA_MAX_LENGTH}
              required
              disabled={isBusy}
              value={autoridadEmisora}
              onChange={(e) => setAutoridadEmisora(e.target.value)}
              placeholder="Ej. Juzgado Primero Familiar / MP"
              aria-invalid={Boolean(fieldErrors.autoridadEmisora)}
              className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
            />
            {fieldErrors.autoridadEmisora ? (
              <p className="mt-1 text-xs text-status-danger">{fieldErrors.autoridadEmisora}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor={emisionId} className="mb-1.5 block text-sm font-medium text-on-surface">
              Fecha de emisión *
            </label>
            <input
              id={emisionId}
              type="date"
              required
              disabled={isBusy}
              value={fechaEmision}
              onChange={(e) => setFechaEmision(e.target.value)}
              aria-invalid={Boolean(fieldErrors.fechaEmision)}
              className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
            />
            {fieldErrors.fechaEmision ? (
              <p className="mt-1 text-xs text-status-danger">{fieldErrors.fechaEmision}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor={vigenciaId} className="mb-1.5 block text-sm font-medium text-on-surface">
              Fecha de vigencia
            </label>
            <input
              id={vigenciaId}
              type="date"
              min={fechaEmision || undefined}
              disabled={isBusy}
              value={fechaVigencia}
              onChange={(e) => setFechaVigencia(e.target.value)}
              aria-invalid={Boolean(fieldErrors.fechaVigencia)}
              className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
            />
            {fieldErrors.fechaVigencia ? (
              <p className="mt-1 text-xs text-status-danger">{fieldErrors.fechaVigencia}</p>
            ) : (
              <p className="mt-1 text-xs text-on-surface-variant">Opcional; vacío = sin vencimiento</p>
            )}
          </div>

          <div>
            <Select
              label="Estado *"
              options={ESTADO_OPTIONS}
              value={estado}
              disabled={isBusy}
              onChange={(next) => setEstado(next as EstadoOrdenProteccion)}
            />
            {fieldErrors.estado ? (
              <p className="mt-1 text-xs text-status-danger">{fieldErrors.estado}</p>
            ) : null}
          </div>
        </div>

        <div>
          <Select
            label="Persona agresora vinculada (opcional)"
            options={agresorOptions}
            value={agresorId}
            disabled={isBusy}
            onChange={(next) => setAgresorId(next)}
          />
        </div>

        <div className="grid gap-2">
          <p className="text-sm font-medium text-on-surface">
            Copia de la orden de protección (opcional)
          </p>
          <Attachment
            instanceRef={attachmentRef}
            accept={ACCEPT_ARCHIVOS}
            multiple={false}
            maxFiles={1}
            maxSize={10 * 1024 * 1024}
            disabled={isBusy}
            hint="JPG, PNG o PDF · Máximo 10 MB"
            labels={ATTACHMENT_LABELS}
            uploads={uploads}
            onFiles={handleFiles}
            onRemove={() => {
              setSelectedFile(null);
              setUploadState(null);
              setFileError(null);
            }}
            onReject={handleReject}
          />
          {fileError ? <p className="text-xs text-status-danger">{fileError}</p> : null}
        </div>
      </Dialog.Body>

      <Dialog.Footer>
        <button
          type="button"
          className="mk-button mk-button--text"
          disabled={isBusy}
          onClick={onCancel}
        >
          Cancelar
        </button>
        <LoadingButton
          type="submit"
          state={submitState}
          labels={LOADING_LABELS}
          disabled={isBusy}
          className="mk-button mk-button--filled"
        >
          {orden ? 'Guardar cambios' : 'Registrar orden'}
        </LoadingButton>
      </Dialog.Footer>
    </form>
  );
}
