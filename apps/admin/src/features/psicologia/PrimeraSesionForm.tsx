import { useState } from 'react';
import { LoadingButton, RadioGroup, Select } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/loading-button';
import '@yewdiel21/motion-kit/css/components/radio-group';
import '@yewdiel21/motion-kit/css/components/select';
import type { ExpedienteClinico, PrimeraSesionInput } from '@/domain/models/HistorialClinico';
import { Icon } from '@/shared/ui/Icon';
import { IconoEnLinea } from './IconoEnLinea';
import { UnsavedChangesDialog } from '@/shared/ui/UnsavedChangesDialog';
import { DictadoVozControl } from './DictadoVozControl';
import { EditorClinico, unirDictado } from './EditorClinico';
import { useRegistroClinicoForm } from './useRegistroClinicoForm';
import { useSpeechDictation } from './useSpeechDictation';

type CampoTexto = 'motivoConsulta' | 'antecedentesFamiliares' | 'antecedentesPersonales' | 'observacionesIniciales';

const CAMPOS: readonly { id: CampoTexto; label: string; requerido?: boolean; ancho?: boolean }[] = [
  { id: 'motivoConsulta', label: 'Motivo de consulta', requerido: true, ancho: true },
  { id: 'antecedentesFamiliares', label: 'Antecedentes familiares' },
  { id: 'antecedentesPersonales', label: 'Antecedentes personales' },
  { id: 'observacionesIniciales', label: 'Observaciones iniciales', ancho: true },
];

const OPCIONES_DESTINO = CAMPOS.map(({ id, label }) => ({ value: id, label }));

const OPCIONES_PREVIA = [
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
  { value: 'desconocido', label: 'No se sabe' },
];

const INICIAL: PrimeraSesionInput = {
  antecedentesFamiliares: '',
  antecedentesPersonales: '',
  motivoConsulta: '',
  observacionesIniciales: '',
  tieneAtencionPsicologicaPrevia: null,
};

function previaAOpcion(valor: boolean | null) {
  return valor === null ? 'desconocido' : valor ? 'si' : 'no';
}

export function PrimeraSesionForm({ expediente, fichaId, empleadoId }: {
  expediente: ExpedienteClinico;
  fichaId: string;
  empleadoId: string;
}) {
  const [datos, setDatos] = useState(INICIAL);
  const [guardado, setGuardado] = useState(false);
  const [campoDictado, setCampoDictado] = useState<CampoTexto>('motivoConsulta');
  const dictado = useSpeechDictation();
  const { guardar, error, isPending, blocker } = useRegistroClinicoForm(
    expediente, fichaId, empleadoId, dictado.activo
      || (!guardado && Object.values(datos).some((value) => value !== '' && value !== null)),
  );
  const bloqueado = isPending || guardado;
  const puedeCambiarDestino = dictado.disponible && !dictado.activo && !bloqueado;
  const destinoLabel = CAMPOS.find(({ id }) => id === campoDictado)?.label;

  return (
    <section aria-labelledby="primera-sesion" className="rounded-3xl border border-outline-variant bg-surface-container-low p-5 sm:p-6">
      <header className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-container text-on-primary-container">
          <Icon name="note_stack_add" />
        </span>
        <div>
          <h2 id="primera-sesion" className="text-xl font-semibold text-on-surface">Primera sesión</h2>
          <p className="mt-0.5 text-sm text-on-surface-variant">
            Captura los datos iniciales. Las observaciones de próximas visitas se registran por separado.
          </p>
        </div>
      </header>

      <form className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]" onSubmit={async (event) => {
        event.preventDefault();
        if (!guardado && !dictado.activo && await guardar({ tipo: 'primera', datos })) setGuardado(true);
      }}>
        <div className="grid gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            {CAMPOS.map(({ id, label, requerido, ancho }) => (
              <div key={id} className={ancho ? 'md:col-span-2' : undefined}>
                <EditorClinico label={label} requerido={requerido} texto={datos[id]} disabled={bloqueado}
                  destinoDictado={dictado.disponible && !bloqueado && campoDictado === id}
                  onElegirDestino={puedeCambiarDestino ? () => setCampoDictado(id) : undefined}
                  onChange={(value) => setDatos((prev) => ({ ...prev, [id]: value }))} />
              </div>
            ))}
          </div>

          <div className="grid gap-2 rounded-2xl bg-surface p-4">
            <span className="text-sm font-medium text-on-surface">¿Ha recibido atención psicológica antes?</span>
            <RadioGroup label="¿Ha recibido atención psicológica antes?" variant="pill" items={OPCIONES_PREVIA}
              value={previaAOpcion(datos.tieneAtencionPsicologicaPrevia)} disabled={bloqueado}
              onChange={(valor) => setDatos((prev) => ({
                ...prev,
                tieneAtencionPsicologicaPrevia: valor === 'si' ? true : valor === 'no' ? false : null,
              }))} />
          </div>

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-error-container px-3 py-2.5 text-sm text-on-error-container">
              <IconoEnLinea name="error" /> <span>{error}</span>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <LoadingButton type="submit" state={isPending ? 'loading' : 'idle'} disabled={bloqueado || dictado.activo}
              className="mk-button mk-button--primary">
              Guardar historial inicial
            </LoadingButton>
            {dictado.activo && (
              <span className="text-xs text-on-surface-variant">Termina o cancela el dictado para guardar.</span>
            )}
          </div>
        </div>

        <div className="lg:sticky lg:top-4">
          <DictadoVozControl dictado={dictado} disabled={bloqueado} destinoLabel={destinoLabel}
            destino={dictado.disponible ? (
              <Select label="Campo para dictar" size="sm" variant="outlined" options={OPCIONES_DESTINO}
                value={campoDictado} disabled={!puedeCambiarDestino} className="w-full"
                onChange={(valor) => {
                  const campo = CAMPOS.find(({ id }) => id === valor)?.id;
                  if (campo) setCampoDictado(campo);
                }} />
            ) : undefined}
            onInsertar={(texto) => setDatos((prev) => ({ ...prev, [campoDictado]: unirDictado(prev[campoDictado], texto) }))} />
        </div>
      </form>
      <UnsavedChangesDialog blocker={blocker} />
    </section>
  );
}
