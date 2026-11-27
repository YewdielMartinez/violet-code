import { useMemo, useState } from 'react';
import { LoadingButton, Select } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/loading-button';
import '@yewdiel21/motion-kit/css/components/select';
import { citasSinAtencion, type ExpedienteClinico, type VisitaClinica } from '@/domain/models/HistorialClinico';
import { Icon } from '@/shared/ui/Icon';
import { IconoEnLinea } from './IconoEnLinea';
import { UnsavedChangesDialog } from '@/shared/ui/UnsavedChangesDialog';
import { DictadoVozControl } from './DictadoVozControl';
import { EditorClinico, unirDictado } from './EditorClinico';
import { formatFechaClinica } from './fechaClinica';
import { useRegistroClinicoForm } from './useRegistroClinicoForm';
import { useSpeechDictation } from './useSpeechDictation';

const SIN_CITA = 'sin-cita';

export function ObservacionSesionForm({ expediente, fichaId, empleadoId }: {
  expediente: ExpedienteClinico;
  fichaId: string;
  empleadoId: string;
}) {
  const [seleccion, setSeleccion] = useState('');
  const [tipoAtencionId, setTipoAtencionId] = useState('');
  const [observacion, setObservacion] = useState('');
  const [faltaVisita, setFaltaVisita] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [idNuevaAtencion, setIdNuevaAtencion] = useState(() => crypto.randomUUID());
  const dictado = useSpeechDictation();
  const { guardar, error, isPending, blocker } = useRegistroClinicoForm(
    expediente, fichaId, empleadoId, dictado.activo || Boolean(seleccion || observacion || tipoAtencionId),
  );
  const esNueva = seleccion === SIN_CITA || seleccion.startsWith('cita:');
  const opcionesVisita = useMemo(() => [
    ...expediente.atenciones.filter((a) => a.activo && a.observaciones === null).map((a) => ({
      value: a.id, label: `Atención · ${formatFechaClinica(a.atendidaEn)}`, group: 'Atenciones sin observación',
    })),
    ...citasSinAtencion(expediente).map((c) => ({
      value: `cita:${c.id}`, label: `Cita asistida · ${formatFechaClinica(c.programadaEn)}`, group: 'Citas asistidas',
    })),
    { value: SIN_CITA, label: 'Nueva atención sin cita (fecha y hora del registro)', group: 'Otra' },
  ], [expediente]);
  const opcionesTipo = useMemo(
    () => expediente.tiposAtencion.map((tipo) => ({ value: String(tipo.id), label: tipo.nombre })),
    [expediente.tiposAtencion],
  );
  const mensajeError = faltaVisita ? 'Elige la visita a la que corresponde la observación.' : error;

  return (
    <section aria-labelledby="nueva-observacion" className="rounded-3xl border border-outline-variant bg-surface-container-low p-5 sm:p-6">
      <header className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-secondary-container text-on-secondary-container">
          <Icon name="edit_note" />
        </span>
        <div>
          <h2 id="nueva-observacion" className="text-xl font-semibold text-on-surface">Nueva observación</h2>
          <p className="mt-0.5 text-sm text-on-surface-variant">
            Cada visita genera su propia observación; las guardadas no se sobrescriben.
          </p>
        </div>
      </header>

      <form className="mt-5 grid gap-4" onSubmit={async (event) => {
        event.preventDefault();
        if (dictado.activo) return;
        if (!seleccion) {
          setFaltaVisita(true);
          return;
        }
        const visita: VisitaClinica = esNueva
          ? {
            tipo: 'nueva',
            id: idNuevaAtencion,
            citaId: seleccion === SIN_CITA ? null : seleccion.slice('cita:'.length),
            tipoAtencionId: Number(tipoAtencionId),
          }
          : { tipo: 'existente', atencionId: seleccion };
        if (await guardar({ tipo: 'seguimiento', visita, observacion })) {
          setSeleccion('');
          setTipoAtencionId('');
          setObservacion('');
          setEditorKey((key) => key + 1);
          setIdNuevaAtencion(crypto.randomUUID());
        }
      }}>
        <div className={`grid gap-3 ${esNueva ? 'sm:grid-cols-2' : ''}`}>
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-on-surface-variant">Visita *</span>
            <Select label="Visita" placeholder="Selecciona una visita…" options={opcionesVisita} value={seleccion}
              disabled={isPending || dictado.activo}
              onChange={(valor) => { setSeleccion(valor); setTipoAtencionId(''); setFaltaVisita(false); }} />
          </div>
          {esNueva && (
            <div className="grid gap-1.5">
              <span className="text-xs font-medium text-on-surface-variant">Tipo de atención *</span>
              <Select label="Tipo de atención" placeholder="Selecciona el tipo…" options={opcionesTipo}
                value={tipoAtencionId} disabled={isPending || dictado.activo} onChange={setTipoAtencionId} />
            </div>
          )}
        </div>

        <DictadoVozControl dictado={dictado} disabled={isPending} destinoLabel="Observación de la sesión"
          onInsertar={(texto) => setObservacion((prev) => unirDictado(prev, texto))} />
        <EditorClinico key={editorKey} label="Observación de la sesión" requerido texto={observacion}
          destinoDictado={dictado.activo} disabled={isPending} onChange={setObservacion} />

        {mensajeError && (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-error-container px-3 py-2.5 text-sm text-on-error-container">
            <IconoEnLinea name="error" /> <span>{mensajeError}</span>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <LoadingButton type="submit" state={isPending ? 'loading' : 'idle'} disabled={isPending || dictado.activo}
            className="mk-button mk-button--primary">
            Guardar observación
          </LoadingButton>
          {dictado.activo && (
            <span className="text-xs text-on-surface-variant">Termina o cancela el dictado para guardar.</span>
          )}
        </div>
      </form>
      <UnsavedChangesDialog blocker={blocker} />
    </section>
  );
}
