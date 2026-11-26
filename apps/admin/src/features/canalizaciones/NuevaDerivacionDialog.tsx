import { useId, useMemo, useState, type FormEvent } from 'react';
import { Dialog, LoadingButton, Select, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import '@yewdiel21/motion-kit/css/components/loading-button';
import '@yewdiel21/motion-kit/css/components/select';
import { useAuth } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';
import {
  DESTINO_LABELS,
  DESTINOS_DERIVACION,
  isInternalDestino,
  useCanalizacionCatalogos,
  useCreateDerivacion,
  validateDerivacion,
  type DestinoDerivacion,
} from './api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fixedFichaId?: string;
  fixedFolio?: string;
}

const DESTINO_OPTIONS = DESTINOS_DERIVACION.map((d) => ({
  value: d,
  label: DESTINO_LABELS[d],
}));

/**
 * Diálogo para registrar una derivación interna o externa (`RF-08`, `RN-03`, `RN-11`).
 * Respeta las reglas de exclusión mutua en PostgreSQL (`04_ficha.sql`).
 */
export function NuevaDerivacionDialog({ open, onOpenChange, fixedFichaId, fixedFolio }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="md">
        <Dialog.Header>
          <Dialog.Title>
            {fixedFolio ? `Nueva canalización · ${fixedFolio}` : 'Nueva canalización'}
          </Dialog.Title>
          <Dialog.Close label="Cerrar" />
        </Dialog.Header>

        {open ? (
          <NuevaDerivacionForm
            key={fixedFichaId ?? 'global'}
            fixedFichaId={fixedFichaId}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </Dialog.Content>
    </Dialog.Root>
  );
}

function NuevaDerivacionForm({
  fixedFichaId,
  onClose,
}: {
  fixedFichaId?: string;
  onClose: () => void;
}) {
  const formId = useId();
  const { user } = useAuth();
  // Con expediente fijo no se muestra el selector: no hace falta descargar el listado.
  const catalogos = useCanalizacionCatalogos({ includeExpedientes: !fixedFichaId });
  const createMutation = useCreateDerivacion();

  const [fichaId, setFichaId] = useState(fixedFichaId ?? '');
  const [areaOrigenId, setAreaOrigenId] = useState<number | null>(user?.areaId ?? null);
  const [destino, setDestino] = useState<DestinoDerivacion>('psicologia');
  const [institucionId, setInstitucionId] = useState<number | null>(null);
  const [institucionOtra, setInstitucionOtra] = useState('');
  const [motivo, setMotivo] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const internal = isInternalDestino(destino);

  const areaDestinoId = useMemo(() => {
    if (!internal) return null;
    const match = (catalogos.areas ?? []).find((a) => a.clave === destino);
    return match?.id ?? null;
  }, [internal, catalogos.areas, destino]);

  const expedienteOptions = useMemo(
    () =>
      (catalogos.expedientes ?? []).map((e) => ({
        value: e.id,
        label: `${e.folio} · ${e.persona.nombreCompleto}`,
      })),
    [catalogos.expedientes],
  );

  const areaOptions = useMemo(
    () => [
      { value: '', label: 'Sin área específica' },
      ...(catalogos.areas ?? []).map((a) => ({ value: String(a.id), label: a.nombre })),
    ],
    [catalogos.areas],
  );

  const institucionOptions = useMemo(
    () => [
      { value: '', label: 'Otra institución (capturar nombre)' },
      ...(catalogos.instituciones ?? []).map((inst) => ({
        value: String(inst.id),
        label: inst.nombre,
      })),
    ],
    [catalogos.instituciones],
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      fichaId,
      areaOrigenId,
      destino,
      areaDestinoId,
      institucionId: internal ? null : institucionId,
      institucionOtra: internal || institucionId !== null ? '' : institucionOtra,
      motivo,
    };

    const validationError = validateDerivacion(payload);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormError(null);
    try {
      await createMutation.mutateAsync(payload);
      toast('Canalización registrada correctamente.');
      onClose();
    } catch {
      toast('No se pudo registrar la canalización. Verifica los datos e intenta de nuevo.', {
        tone: 'error',
      });
    }
  }

  return (
    <>
      <Dialog.Body>
          <form id={formId} onSubmit={handleSubmit} className="grid gap-4" noValidate>
            {!fixedFichaId ? (
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-on-surface-variant">Expediente *</span>
                <Select
                  label="Expediente *"
                  placeholder="Selecciona expediente…"
                  options={expedienteOptions}
                  value={fichaId}
                  onChange={setFichaId}
                />
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-on-surface-variant">Área de origen</span>
                <Select
                  label="Área de origen"
                  options={areaOptions}
                  value={areaOrigenId ? String(areaOrigenId) : ''}
                  onChange={(v) => setAreaOrigenId(v ? Number(v) : null)}
                />
              </div>

              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-on-surface-variant">Destino *</span>
                <Select
                  label="Destino *"
                  options={DESTINO_OPTIONS}
                  value={destino}
                  onChange={(v) => {
                    const next = v as DestinoDerivacion;
                    setDestino(next);
                    setInstitucionId(null);
                    setInstitucionOtra('');
                  }}
                />
              </div>
            </div>

            {!internal ? (
              <div className="grid gap-3 rounded-2xl bg-surface-container-low p-4">
                <div className="grid gap-1.5">
                  <span className="text-xs font-medium text-on-surface-variant">
                    Institución del directorio
                  </span>
                  <Select
                    label="Institución del directorio"
                    options={institucionOptions}
                    value={institucionId ? String(institucionId) : ''}
                    onChange={(v) => {
                      const nextId = v ? Number(v) : null;
                      setInstitucionId(nextId);
                      if (nextId !== null) setInstitucionOtra('');
                    }}
                  />
                </div>

                {institucionId === null ? (
                  <label className="mk-field">
                    <span className="mk-field__label">
                      Nombre de la institución externa {destino === 'otra_institucion' ? '*' : ''}
                    </span>
                    <input
                      type="text"
                      maxLength={200}
                      placeholder={
                        destino === 'refugio'
                          ? 'Solo nombre del refugio (nunca capturar dirección)'
                          : 'Nombre de la dependencia o institución'
                      }
                      value={institucionOtra}
                      onChange={(e) => setInstitucionOtra(e.target.value)}
                    />
                  </label>
                ) : null}
              </div>
            ) : null}

            <label className="mk-field">
              <span className="mk-field__label">Motivo de la canalización *</span>
              <textarea
                rows={3}
                maxLength={1000}
                required
                placeholder="Describe brevemente por qué se canaliza a la usuaria"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </label>

            {formError ? (
              <p role="alert" className="rounded-xl bg-status-danger-bg px-3 py-2 text-sm text-status-danger">
                {formError}
              </p>
            ) : null}
          </form>
        </Dialog.Body>

      <Dialog.Footer>
        <button type="button" className="mk-button mk-button--text" onClick={onClose}>
          Cancelar
        </button>
        <LoadingButton
          type="submit"
          form={formId}
          state={createMutation.isPending ? 'loading' : 'idle'}
          className="mk-button mk-button--filled"
        >
          <Icon name="alt_route" />
          <span className="ml-2">Registrar canalización</span>
        </LoadingButton>
      </Dialog.Footer>
    </>
  );
}
