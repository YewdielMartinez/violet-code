import { esMayorDeEdadClinica, validarRegistroClinico } from '@/domain/models/HistorialClinico';
import type { HistorialClinicoRepository } from '@/domain/ports/HistorialClinicoRepository';
import { supabase } from '../client';

function errorClinico(code?: string): Error {
  switch (code) {
    case '23505':
      return new Error('Este registro ya existe. Se recargarán los datos sin sobrescribirlo.');
    case '42501':
      return new Error('No tienes permisos para realizar esta acción.');
    case '23503':
      return new Error('La cita o el tipo de atención ya no está disponible. Recarga e intenta de nuevo.');
    case '23514':
    case 'P0001':
      return new Error('El registro no cumple las reglas de atención de Psicología. Revisa los datos de la visita.');
    default:
      return new Error('No se pudo completar la operación. Verifica tu conexión e intenta de nuevo.');
  }
}

async function obtenerAreaClinica(signal?: AbortSignal) {
  const query = supabase.from('cat_area').select('id').eq('clave', 'psicologia');
  const { data, error } = await (signal ? query.abortSignal(signal) : query).single();
  if (error) throw errorClinico(error.code);
  return data.id;
}

export const supabaseHistorialClinicoRepository: HistorialClinicoRepository = {
  async consultar(fichaId, signal) {
    const fichaQuery = supabase.from('ficha_registro')
      .select('folio, persona_id, persona!inner(fecha_nacimiento)').eq('id', fichaId);
    const { data: ficha, error } = await (signal ? fichaQuery.abortSignal(signal) : fichaQuery).maybeSingle();
    if (error) throw errorClinico(error.code);
    if (!ficha) return null;

    const areaId = await obtenerAreaClinica(signal);
    const historialQuery = supabase.from('historial_clinico')
      .select('id, antecedentes_familiares, antecedentes_personales, motivo_consulta, observaciones_iniciales, tiene_atencion_psicologica_previa, activo, creado_en')
      .eq('ficha_id', fichaId);
    const atencionesQuery = supabase.from('atencion')
      .select('id, cita_id, atendida_en, observaciones, tipo_atencion_id, activo')
      .eq('ficha_id', fichaId).eq('area_id', areaId).order('atendida_en', { ascending: false });
    const citasQuery = supabase.from('cita').select('id, programada_en')
      .eq('persona_id', ficha.persona_id).eq('area_id', areaId).eq('activo', true)
      .eq('estado', 'asistio').lte('programada_en', new Date().toISOString())
      .order('programada_en', { ascending: false });
    const tiposQuery = supabase.from('cat_tipo_atencion').select('id, nombre')
      .eq('area_id', areaId).order('nombre');
    if (signal) {
      historialQuery.abortSignal(signal);
      atencionesQuery.abortSignal(signal);
      citasQuery.abortSignal(signal);
      tiposQuery.abortSignal(signal);
    }
    const [historial, atenciones, citas, tipos] = await Promise.all([
      historialQuery.maybeSingle(), atencionesQuery, citasQuery, tiposQuery,
    ]);
    const readError = historial.error ?? atenciones.error ?? citas.error ?? tipos.error;
    if (readError) throw errorClinico(readError.code);

    const h = historial.data;
    return {
      folio: ficha.folio,
      puedeRegistrarAtencion: esMayorDeEdadClinica(ficha.persona.fecha_nacimiento),
      historial: h && {
        id: h.id,
        antecedentesFamiliares: h.antecedentes_familiares ?? '',
        antecedentesPersonales: h.antecedentes_personales ?? '',
        motivoConsulta: h.motivo_consulta ?? '',
        observacionesIniciales: h.observaciones_iniciales ?? '',
        tieneAtencionPsicologicaPrevia: h.tiene_atencion_psicologica_previa,
        activo: h.activo,
        creadoEn: h.creado_en,
      },
      atenciones: (atenciones.data ?? []).map((a) => ({
        id: a.id,
        citaId: a.cita_id,
        atendidaEn: a.atendida_en,
        observaciones: a.observaciones,
        tipoAtencionId: a.tipo_atencion_id,
        activo: a.activo,
      })),
      citas: (citas.data ?? []).map((c) => ({ id: c.id, programadaEn: c.programada_en })),
      tiposAtencion: tipos.data ?? [],
    };
  },

  async guardar(fichaId, empleadoId, input) {
    const expediente = await this.consultar(fichaId);
    if (!expediente) throw errorClinico('42501');
    const errorValidacion = validarRegistroClinico(expediente, input);
    if (errorValidacion) throw new Error(errorValidacion);

    if (input.tipo === 'primera') {
      const d = input.datos;
      // INSERT, no upsert: ante concurrencia la restricción UNIQUE preserva la primera sesión.
      const { error } = await supabase.from('historial_clinico').insert({
        ficha_id: fichaId,
        creado_por: empleadoId,
        antecedentes_familiares: d.antecedentesFamiliares.trim() || null,
        antecedentes_personales: d.antecedentesPersonales.trim() || null,
        motivo_consulta: d.motivoConsulta.trim(),
        observaciones_iniciales: d.observacionesIniciales.trim() || null,
        tiene_atencion_psicologica_previa: d.tieneAtencionPsicologicaPrevia,
      });
      if (error) throw errorClinico(error.code);
      return;
    }

    const areaId = await obtenerAreaClinica();
    const { visita } = input;
    const observacion = input.observacion.trim();

    if (visita.tipo === 'existente') {
      // Completar una hoja existente una sola vez, sin tocar otros campos del seguimiento.
      const { data, error } = await supabase.from('atencion').update({ observaciones: observacion })
        .eq('id', visita.atencionId).eq('ficha_id', fichaId).eq('area_id', areaId)
        .eq('activo', true).is('observaciones', null).select('id').maybeSingle();
      if (error) throw errorClinico(error.code);
      if (!data) throw errorClinico('23505');
      return;
    }

    const fechaCita = expediente.citas.find((cita) => cita.id === visita.citaId)?.programadaEn;
    const { error } = await supabase.from('atencion').insert({
      id: visita.id,
      ficha_id: fichaId,
      area_id: areaId,
      cita_id: visita.citaId,
      tipo_atencion_id: visita.tipoAtencionId,
      // Al documentar una cita histórica, conservar la fecha de la visita, no la de captura.
      atendida_en: fechaCita,
      observaciones: observacion,
      atendida_por: empleadoId,
      creado_por: empleadoId,
    });
    if (error) throw errorClinico(error.code);
  },

  async registrarConsulta(fichaId, historialId) {
    const { error } = await supabase.rpc('registrar_consulta', {
      p_tabla: historialId ? 'historial_clinico' : 'ficha_registro',
      p_registro_id: historialId ?? fichaId,
    });
    if (error) throw errorClinico(error.code);
  },
};
