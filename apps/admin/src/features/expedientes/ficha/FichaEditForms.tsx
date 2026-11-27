import { useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { GlassSwitch, LoadingButton, MultiSelect, Select, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import '@yewdiel21/motion-kit/css/components/glass-switch';
import '@yewdiel21/motion-kit/css/components/loading-button';
import '@yewdiel21/motion-kit/css/components/menu';
import '@yewdiel21/motion-kit/css/components/multi-select';
import '@yewdiel21/motion-kit/css/components/select';
import { DROGA_LABELS, TIPOS_DROGA, type TipoDroga } from '@/domain/models/Agresor';
import { INITIAL_DOMICILIO_INPUT, type DomicilioInput } from '@/domain/models/Domicilio';
import {
  INITIAL_ESTUDIO_INPUT,
  type BienVivienda,
  type EstudioSocioeconomicoInput,
  type ServicioVivienda,
} from '@/domain/models/EstudioSocioeconomico';
import {
  CONSUMO_ALCOHOL_LABELS,
  ESTADO_CIVIL_LABELS,
  SERVICIO_MEDICO_LABELS,
  type ConsumoAlcohol,
  type EstadoCivil,
  type FichaCompletaDetalle,
  type ServicioMedico,
} from '@/domain/models/FichaRegistro';
import {
  handleExpedienteMutationError,
  useActualizarDomicilio,
  useActualizarFicha,
  useCatalogosFicha,
  useRegistrarEstudio,
} from '../api';
import { FichaDomicilioStep } from './FichaDomicilioStep';
import { FichaSocioeconomicoStep } from './FichaSocioeconomicoStep';
import { validateStepDomicilio, validateStepEstudio } from './fichaValidation';

const SAVE_LABELS = { loading: 'Guardando…', success: 'Guardado', error: 'Error al guardar' };

const ESTADO_CIVIL_OPTIONS = Object.entries(ESTADO_CIVIL_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const SERVICIO_MEDICO_OPTIONS = Object.entries(SERVICIO_MEDICO_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const CONSUMO_ALCOHOL_OPTIONS = Object.entries(CONSUMO_ALCOHOL_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const DROGA_OPTIONS: { value: TipoDroga; label: string }[] = [
  { value: 'no_consume', label: DROGA_LABELS.no_consume },
  ...TIPOS_DROGA.map((value) => ({ value, label: DROGA_LABELS[value] })),
];

interface FormProps {
  detail: FichaCompletaDetalle;
  onCancel: () => void;
  onSaved: () => void;
}

interface FichaDatosDraft {
  estadoCivil: EstadoCivil | '';
  ocupacionId: number | null;
  ocupacionOtra: string;
  tieneTrabajo: boolean;
  numeroHijas: string;
  numeroHijosHombres: string;
  servicioMedico: ServicioMedico | '';
  servicioMedicoOtro: string;
  tieneEmbarazo: boolean;
  tieneDenuncia: boolean;
  esVictimaDelito: boolean;
  drogas: TipoDroga[];
  especificacionDroga: string;
  consumoAlcohol: ConsumoAlcohol | '';
  serviciosSolicitadosAreaIds: number[];
}

function buildFichaDraft(detail: FichaCompletaDetalle): FichaDatosDraft {
  return {
    estadoCivil: detail.estadoCivil ?? '',
    ocupacionId: detail.ocupacionId,
    ocupacionOtra: detail.ocupacionOtra ?? '',
    tieneTrabajo: Boolean(detail.tieneTrabajo),
    numeroHijas: detail.numeroHijas !== null ? String(detail.numeroHijas) : '',
    numeroHijosHombres: detail.numeroHijosHombres !== null ? String(detail.numeroHijosHombres) : '',
    servicioMedico: detail.servicioMedico ?? 'ninguno',
    servicioMedicoOtro: detail.servicioMedicoOtro ?? '',
    tieneEmbarazo: Boolean(detail.tieneEmbarazo),
    tieneDenuncia: Boolean(detail.tieneDenuncia),
    esVictimaDelito: Boolean(detail.esVictimaDelito),
    drogas: detail.drogas,
    especificacionDroga: detail.especificacionDroga ?? '',
    consumoAlcohol: detail.consumoAlcohol ?? '',
    serviciosSolicitadosAreaIds: detail.serviciosSolicitadosAreaIds,
  };
}

/** Formulario de edición de datos de Ficha Única y servicios solicitados (`actualizar_ficha`). */
export function FichaDatosEditForm({ detail, onCancel, onSaved }: FormProps) {
  const queryClient = useQueryClient();
  const { data: catalogos } = useCatalogosFicha(true);
  const actualizar = useActualizarFicha(detail.id);
  const [draft, setDraft] = useState<FichaDatosDraft>(() => buildFichaDraft(detail));

  const areaOptions = useMemo(
    () => (catalogos?.areas ?? []).map((a) => ({ value: String(a.id), label: a.nombre })),
    [catalogos?.areas],
  );
  const ocupacionOptions = useMemo(
    () => (catalogos?.ocupaciones ?? []).map((o) => ({ value: String(o.id), label: o.nombre })),
    [catalogos?.ocupaciones],
  );

  function handleDrogasChange(nextRaw: string[]) {
    const next = nextRaw as TipoDroga[];
    const hadNoConsume = draft.drogas.includes('no_consume');
    const hasNoConsume = next.includes('no_consume');

    if (hasNoConsume && !hadNoConsume) {
      setDraft({ ...draft, drogas: ['no_consume'], especificacionDroga: '' });
      return;
    }
    const filtered = hasNoConsume && next.length > 1 ? next.filter((d) => d !== 'no_consume') : next;
    setDraft({ ...draft, drogas: filtered });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.servicioMedico === 'otro' && !draft.servicioMedicoOtro.trim()) {
      toast('Especifica el servicio médico cuando selecciones «Otro».', { tone: 'error' });
      return;
    }

    const hijas = draft.numeroHijas.trim() ? Number(draft.numeroHijas) : null;
    const hijos = draft.numeroHijosHombres.trim() ? Number(draft.numeroHijosHombres) : null;
    if (hijas !== null && (!Number.isInteger(hijas) || hijas < 0 || hijas > 30)) {
      toast('El número de hijas debe estar entre 0 y 30.', { tone: 'error' });
      return;
    }
    if (hijos !== null && (!Number.isInteger(hijos) || hijos < 0 || hijos > 30)) {
      toast('El número de hijos debe estar entre 0 y 30.', { tone: 'error' });
      return;
    }
    if (draft.serviciosSolicitadosAreaIds.length === 0) {
      toast('Selecciona al menos un servicio solicitado.', { tone: 'error' });
      return;
    }

    try {
      await actualizar.mutateAsync({
        fichaId: detail.id,
        actualizadoEn: detail.actualizadoEn ?? '',
        estadoCivil: draft.estadoCivil || null,
        ocupacionId: draft.ocupacionId,
        ocupacionOtra: draft.ocupacionOtra,
        tieneTrabajo: draft.tieneTrabajo,
        numeroHijas: hijas,
        numeroHijosHombres: hijos,
        servicioMedico: draft.servicioMedico || null,
        servicioMedicoOtro: draft.servicioMedico === 'otro' ? draft.servicioMedicoOtro : '',
        tieneEmbarazo: draft.tieneEmbarazo,
        tieneDenuncia: draft.tieneDenuncia,
        esVictimaDelito: draft.esVictimaDelito,
        drogas: draft.drogas.length > 0 ? draft.drogas : null,
        especificacionDroga: draft.drogas.includes('otra') ? draft.especificacionDroga : '',
        consumoAlcohol: draft.consumoAlcohol || null,
        serviciosSolicitadosAreaIds: draft.serviciosSolicitadosAreaIds,
      });
      toast('Ficha actualizada.', { tone: 'success' });
      onSaved();
    } catch (err) {
      handleExpedienteMutationError(
        err,
        queryClient,
        detail.id,
        'No se pudieron guardar los datos de la ficha.',
      );
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="vc-ficha-form grid gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <span className="vc-ficha-label">Estado civil</span>
          <Select
            size="lg"
            label="Estado civil"
            placeholder="Selecciona…"
            options={ESTADO_CIVIL_OPTIONS}
            value={draft.estadoCivil}
            onChange={(v) => setDraft({ ...draft, estadoCivil: v as EstadoCivil })}
          />
        </div>
        <div className="grid gap-2">
          <span className="vc-ficha-label">Ocupación</span>
          <Select
            size="lg"
            label="Ocupación"
            placeholder="Selecciona…"
            options={ocupacionOptions}
            value={draft.ocupacionId ? String(draft.ocupacionId) : ''}
            onChange={(v) => setDraft({ ...draft, ocupacionId: v ? Number(v) : null })}
          />
        </div>
      </div>

      <label className="mk-field">
        <span className="mk-field__label">Otra ocupación / detalle</span>
        <input
          type="text"
          maxLength={100}
          value={draft.ocupacionOtra}
          onChange={(e) => setDraft({ ...draft, ocupacionOtra: e.target.value })}
          placeholder="Opcional si no aparece en catálogo"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <span className="vc-ficha-label">Servicio médico</span>
          <Select
            size="lg"
            label="Servicio médico"
            options={SERVICIO_MEDICO_OPTIONS}
            value={draft.servicioMedico}
            onChange={(v) => setDraft({ ...draft, servicioMedico: v as ServicioMedico })}
          />
        </div>
        {draft.servicioMedico === 'otro' ? (
          <label className="mk-field">
            <span className="mk-field__label">Especificar servicio médico *</span>
            <input
              type="text"
              maxLength={100}
              value={draft.servicioMedicoOtro}
              onChange={(e) => setDraft({ ...draft, servicioMedicoOtro: e.target.value })}
            />
          </label>
        ) : (
          <div className="grid gap-2">
            <span className="vc-ficha-label">Consumo de alcohol</span>
            <Select
              size="lg"
              label="Consumo de alcohol"
              placeholder="Selecciona…"
              options={CONSUMO_ALCOHOL_OPTIONS}
              value={draft.consumoAlcohol}
              onChange={(v) => setDraft({ ...draft, consumoAlcohol: v as ConsumoAlcohol })}
            />
          </div>
        )}
      </div>

      {draft.servicioMedico === 'otro' ? (
        <div className="grid gap-2">
          <span className="vc-ficha-label">Consumo de alcohol</span>
          <Select
            size="lg"
            label="Consumo de alcohol"
            placeholder="Selecciona…"
            options={CONSUMO_ALCOHOL_OPTIONS}
            value={draft.consumoAlcohol}
            onChange={(v) => setDraft({ ...draft, consumoAlcohol: v as ConsumoAlcohol })}
          />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="mk-field">
          <span className="mk-field__label">Número de hijas</span>
          <input
            type="number"
            min={0}
            max={30}
            value={draft.numeroHijas}
            onChange={(e) => setDraft({ ...draft, numeroHijas: e.target.value })}
          />
        </label>
        <label className="mk-field">
          <span className="mk-field__label">Número de hijos</span>
          <input
            type="number"
            min={0}
            max={30}
            value={draft.numeroHijosHombres}
            onChange={(e) => setDraft({ ...draft, numeroHijosHombres: e.target.value })}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <span className="vc-ficha-label">Consumo de sustancias</span>
          <MultiSelect
            size="lg"
            label="Consumo de sustancias"
            placeholder="Selecciona…"
            options={DROGA_OPTIONS}
            value={draft.drogas}
            onChange={handleDrogasChange}
          />
        </div>
        <div className="grid gap-2">
          <span className="vc-ficha-label">Servicios solicitados *</span>
          <MultiSelect
            size="lg"
            label="Servicios solicitados *"
            placeholder="Selecciona una o más áreas…"
            options={areaOptions}
            value={draft.serviciosSolicitadosAreaIds.map(String)}
            onChange={(vals) =>
              setDraft({ ...draft, serviciosSolicitadosAreaIds: vals.map(Number) })
            }
          />
        </div>
      </div>

      {draft.drogas.includes('otra') ? (
        <label className="mk-field">
          <span className="mk-field__label">Especificación de sustancia</span>
          <input
            type="text"
            maxLength={150}
            value={draft.especificacionDroga}
            onChange={(e) => setDraft({ ...draft, especificacionDroga: e.target.value })}
          />
        </label>
      ) : null}

      <div className="grid gap-3 rounded-2xl bg-surface-container-low p-4 sm:grid-cols-2 sm:gap-x-6">
        <GlassSwitch
          checked={draft.tieneTrabajo}
          onChange={(checked) => setDraft({ ...draft, tieneTrabajo: checked })}
        >
          Cuenta con trabajo remunerado
        </GlassSwitch>
        <GlassSwitch
          checked={draft.tieneEmbarazo}
          onChange={(checked) => setDraft({ ...draft, tieneEmbarazo: checked })}
        >
          Embarazo actual
        </GlassSwitch>
        <GlassSwitch
          checked={draft.tieneDenuncia}
          onChange={(checked) => setDraft({ ...draft, tieneDenuncia: checked })}
        >
          Cuenta con denuncia previa
        </GlassSwitch>
        <GlassSwitch
          checked={draft.esVictimaDelito}
          onChange={(checked) => setDraft({ ...draft, esVictimaDelito: checked })}
        >
          Víctima de delito
        </GlassSwitch>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={actualizar.isPending}
          onClick={onCancel}
          className="mk-button mk-button--text"
        >
          Cancelar
        </button>
        <LoadingButton
          type="submit"
          state={actualizar.isPending ? 'loading' : 'idle'}
          labels={SAVE_LABELS}
          disabled={actualizar.isPending}
          className="mk-button mk-button--filled"
        >
          Guardar cambios
        </LoadingButton>
      </div>
    </form>
  );
}

function buildDomicilioDraft(detail: FichaCompletaDetalle): DomicilioInput {
  const dom = detail.domicilio;
  if (!dom) return INITIAL_DOMICILIO_INPUT;
  return {
    asentamientoId: dom.asentamientoId,
    codigoPostalForaneo: dom.asentamientoId === null ? (dom.codigoPostal ?? '') : '',
    calle: dom.calle ?? '',
    numeroExterior: dom.numeroExterior ?? '',
    numeroInterior: dom.numeroInterior ?? '',
    referencias: dom.referencias ?? '',
    zona: dom.zona ?? 'urbana',
  };
}

/** Formulario de edición de domicilio reutilizando `FichaDomicilioStep` (`actualizar_domicilio`). */
export function FichaDomicilioEditForm({ detail, onCancel, onSaved }: FormProps) {
  const queryClient = useQueryClient();
  const actualizar = useActualizarDomicilio(detail.id);
  const [draft, setDraft] = useState<DomicilioInput>(() => buildDomicilioDraft(detail));
  const [invalidField, setInvalidField] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const failure = validateStepDomicilio(draft);
    if (failure) {
      setInvalidField(failure.field);
      toast(failure.error, { tone: 'error' });
      return;
    }
    setInvalidField(null);

    try {
      await actualizar.mutateAsync({
        personaId: detail.persona.id,
        actualizadoEn: detail.domicilio?.actualizadoEn ?? null,
        asentamientoId: draft.asentamientoId,
        codigoPostal: draft.asentamientoId === null ? draft.codigoPostalForaneo : null,
        calle: draft.calle,
        numeroExterior: draft.numeroExterior,
        numeroInterior: draft.numeroInterior,
        referencias: draft.referencias,
        zona: draft.zona || null,
      });
      toast('Domicilio actualizado.', { tone: 'success' });
      onSaved();
    } catch (err) {
      handleExpedienteMutationError(
        err,
        queryClient,
        detail.id,
        'No se pudo actualizar el domicilio.',
      );
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4">
      <FichaDomicilioStep
        value={draft}
        onChange={(next) => {
          setInvalidField(null);
          setDraft(next);
        }}
        invalidField={invalidField}
      />

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={actualizar.isPending}
          onClick={onCancel}
          className="mk-button mk-button--text"
        >
          Cancelar
        </button>
        <LoadingButton
          type="submit"
          state={actualizar.isPending ? 'loading' : 'idle'}
          labels={SAVE_LABELS}
          disabled={actualizar.isPending}
          className="mk-button mk-button--filled"
        >
          Guardar domicilio
        </LoadingButton>
      </div>
    </form>
  );
}

function buildEstudioDraft(detail: FichaCompletaDetalle): EstudioSocioeconomicoInput {
  const est = detail.estudio;
  if (!est) return INITIAL_ESTUDIO_INPUT;
  return {
    ingresoMensualPropio:
      est.ingresoMensualPropio !== null ? String(est.ingresoMensualPropio) : '',
    numeroDependientes: est.numeroDependientes !== null ? String(est.numeroDependientes) : '0',
    tieneApoyo: est.tieneApoyo,
    especificacionApoyo: est.especificacionApoyo ?? '',
    tipoVivienda: est.tipoVivienda ?? '',
    material: est.material ?? '',
    materialOtro: est.materialOtro ?? '',
    servicios: est.servicios,
    bienes: est.bienes,
    aportantes: est.aportantes.map((ap) => ({
      nombre: ap.nombre,
      parentescoId: ap.parentescoId ?? null,
      parentescoOtro: ap.parentescoOtro ?? '',
      ocupacionId: ap.ocupacionId ?? null,
      ocupacionOtra: ap.ocupacionOtra ?? '',
      tipoTrabajo: ap.tipoTrabajo ?? '',
      monto: ap.monto !== null ? String(ap.monto) : '',
      frecuencia: ap.frecuencia ?? '',
    })),
  };
}

/** Formulario de edición del estudio socioeconómico reutilizando `FichaSocioeconomicoStep` (`registrar_estudio_socioeconomico`). */
export function FichaEstudioEditForm({ detail, onCancel, onSaved }: FormProps) {
  const queryClient = useQueryClient();
  const { data: catalogos } = useCatalogosFicha(true);
  const registrar = useRegistrarEstudio(detail.id);
  const [draft, setDraft] = useState<EstudioSocioeconomicoInput>(() => buildEstudioDraft(detail));
  const [invalidField, setInvalidField] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const failure = validateStepEstudio(draft);
    if (failure) {
      setInvalidField(failure.field);
      toast(failure.error, { tone: 'error' });
      return;
    }
    setInvalidField(null);

    try {
      await registrar.mutateAsync({
        fichaId: detail.id,
        ingresoMensualPropio: draft.ingresoMensualPropio.trim()
          ? Number(draft.ingresoMensualPropio)
          : null,
        numeroDependientes: draft.numeroDependientes.trim()
          ? Number(draft.numeroDependientes)
          : null,
        tieneApoyo: draft.tieneApoyo,
        especificacionApoyo: draft.tieneApoyo ? draft.especificacionApoyo : '',
        tipoVivienda: draft.tipoVivienda || null,
        material: draft.material || null,
        materialOtro: draft.material === 'otro' ? draft.materialOtro : '',
        servicios: draft.servicios as ServicioVivienda[],
        bienes: draft.bienes as BienVivienda[],
        aportantes: draft.aportantes.map((ap) => ({
          nombre: ap.nombre,
          parentescoId: ap.parentescoId,
          parentescoOtro: ap.parentescoOtro,
          ocupacionId: ap.ocupacionId,
          ocupacionOtra: ap.ocupacionOtra,
          tipoTrabajo: ap.tipoTrabajo || null,
          monto: ap.monto.trim() ? Number(ap.monto) : null,
          frecuencia: ap.frecuencia || null,
        })),
      });
      toast('Estudio socioeconómico actualizado.', { tone: 'success' });
      onSaved();
    } catch (err) {
      handleExpedienteMutationError(
        err,
        queryClient,
        detail.id,
        'No se pudo guardar el estudio socioeconómico.',
      );
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4">
      <FichaSocioeconomicoStep
        value={draft}
        onChange={(next) => {
          setInvalidField(null);
          setDraft(next);
        }}
        catalogos={catalogos}
        invalidField={invalidField}
      />

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={registrar.isPending}
          onClick={onCancel}
          className="mk-button mk-button--text"
        >
          Cancelar
        </button>
        <LoadingButton
          type="submit"
          state={registrar.isPending ? 'loading' : 'idle'}
          labels={SAVE_LABELS}
          disabled={registrar.isPending}
          className="mk-button mk-button--filled"
        >
          Guardar estudio
        </LoadingButton>
      </div>
    </form>
  );
}
