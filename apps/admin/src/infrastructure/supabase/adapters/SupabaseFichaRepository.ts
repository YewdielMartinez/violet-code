import { supabase } from '../client';
import type { DomicilioDetalle } from '@/domain/models/Domicilio';
import type { EstudioSocioeconomicoDetalle } from '@/domain/models/EstudioSocioeconomico';
import type { FichaCompletaDetalle, FichaCreateInput } from '@/domain/models/FichaRegistro';
import { formatFullName, normalizeCurp, type SexoBiologico } from '@/domain/models/Persona';
import type { CreatedFichaResult, FichaRepository } from '@/domain/ports/FichaRepository';

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function emptyToNull(value: string): string | null {
  const clean = value.trim();
  return clean.length > 0 ? clean : null;
}

function toOptionalNumber(value: string): number | null {
  const clean = value.trim();
  if (!clean) return null;
  const num = Number(clean);
  return Number.isFinite(num) ? num : null;
}

export const supabaseFichaRepository: FichaRepository = {
  async createComplete(input: FichaCreateInput): Promise<CreatedFichaResult> {
    const { identidad, domicilio, estudio } = input;
    const curp = normalizeCurp(identidad.curp);

    let personaId = identidad.existingPersonaId;
    if (!personaId) {
      const { data: existingPersona, error: lookupError } = await supabase
        .from('persona')
        .select('id, ficha_registro(id, activo)')
        .eq('curp', curp)
        .maybeSingle();

      if (lookupError) throw lookupError;

      if (existingPersona) {
        const hasActiveFicha = Array.isArray(existingPersona.ficha_registro)
          ? existingPersona.ficha_registro.some((f) => f.activo)
          : Boolean(existingPersona.ficha_registro?.activo);
        if (hasActiveFicha) {
          throw new Error('Esta persona ya tiene una Ficha Única registrada con esa CURP.');
        }
        personaId = existingPersona.id;
      } else {
        const { data: personaRow, error: personaError } = await supabase
          .from('persona')
          .insert({
            curp,
            nombres: identidad.nombres.trim(),
            apellido_paterno: identidad.apellidoPaterno.trim(),
            apellido_materno: emptyToNull(identidad.apellidoMaterno),
            celular: emptyToNull(identidad.celular),
            escolaridad: identidad.escolaridad || null,
            discapacidad_id: identidad.discapacidadId,
            grupo_etnico_id: identidad.grupoEtnicoId,
            religion_id: identidad.religionId,
          })
          .select('id')
          .single();

        if (personaError) throw personaError;
        personaId = personaRow.id;
      }
    }

    const { data: fichaRow, error: fichaError } = await supabase
      .from('ficha_registro')
      .insert({
        persona_id: personaId,
        aviso_privacidad_aceptado_en: new Date().toISOString(),
        estado_civil: identidad.estadoCivil || null,
        ocupacion_id: identidad.ocupacionId,
        ocupacion_otra: emptyToNull(identidad.ocupacionOtra),
        tiene_trabajo: identidad.tieneTrabajo,
        numero_hijas: toOptionalNumber(identidad.numeroHijas),
        numero_hijos_hombres: toOptionalNumber(identidad.numeroHijosHombres),
        servicio_medico: identidad.servicioMedico || null,
        servicio_medico_otro:
          identidad.servicioMedico === 'otro' ? emptyToNull(identidad.servicioMedicoOtro) : null,
        tiene_embarazo: identidad.tieneEmbarazo,
        tiene_denuncia: identidad.tieneDenuncia,
        es_victima_delito: identidad.esVictimaDelito,
      })
      .select('id, folio')
      .single();

    if (fichaError) throw fichaError;

    if (identidad.serviciosSolicitadosAreaIds.length > 0) {
      const { error: srvError } = await supabase.from('ficha_servicio_solicitado').insert(
        identidad.serviciosSolicitadosAreaIds.map((areaId) => ({
          ficha_id: fichaRow.id,
          area_id: areaId,
        })),
      );
      if (srvError) throw srvError;
    }

    const { error: domError } = await supabase.from('domicilio').insert({
      persona_id: personaId,
      asentamiento_id: domicilio.asentamientoId,
      codigo_postal:
        domicilio.asentamientoId === null ? emptyToNull(domicilio.codigoPostalForaneo) : null,
      calle: emptyToNull(domicilio.calle),
      numero_exterior: emptyToNull(domicilio.numeroExterior),
      numero_interior: emptyToNull(domicilio.numeroInterior),
      referencias: emptyToNull(domicilio.referencias),
      zona: domicilio.zona || null,
      es_actual: true,
    });
    if (domError) throw domError;

    const { data: estudioRow, error: estError } = await supabase
      .from('estudio_socioeconomico')
      .insert({
        ficha_id: fichaRow.id,
        es_actual: true,
        ingreso_mensual_propio: toOptionalNumber(estudio.ingresoMensualPropio),
        numero_dependientes: toOptionalNumber(estudio.numeroDependientes),
        tiene_apoyo: estudio.tieneApoyo,
        especificacion_apoyo: estudio.tieneApoyo ? emptyToNull(estudio.especificacionApoyo) : null,
        tipo_vivienda: estudio.tipoVivienda || null,
        material: estudio.material || null,
        material_otro: estudio.material === 'otro' ? emptyToNull(estudio.materialOtro) : null,
        servicios: estudio.servicios.length > 0 ? estudio.servicios : null,
        bienes: estudio.bienes.length > 0 ? estudio.bienes : null,
      })
      .select('id')
      .single();

    if (estError) throw estError;

    if (estudio.aportantes.length > 0) {
      const { error: apError } = await supabase.from('aportante_hogar').insert(
        estudio.aportantes.map((ap) => ({
          estudio_socioeconomico_id: estudioRow.id,
          nombre: ap.nombre.trim(),
          parentesco_id: ap.parentescoId,
          parentesco_otro: emptyToNull(ap.parentescoOtro),
          ocupacion_id: ap.ocupacionId,
          ocupacion_otra: emptyToNull(ap.ocupacionOtra),
          tipo_trabajo: ap.tipoTrabajo || null,
          monto: toOptionalNumber(ap.monto),
          frecuencia: ap.frecuencia || null,
        })),
      );
      if (apError) throw apError;
    }

    return {
      fichaId: fichaRow.id,
      folio: fichaRow.folio,
      personaId,
    };
  },

  async getDetail(fichaId: string): Promise<FichaCompletaDetalle | null> {
    const { data: fichaRow, error: fichaError } = await supabase
      .from('ficha_registro')
      .select(
        'id, folio, estado, registrada_en, aviso_privacidad_aceptado_en, estado_civil, servicio_medico, servicio_medico_otro, tiene_trabajo, numero_hijas, numero_hijos_hombres, tiene_embarazo, tiene_denuncia, es_victima_delito, persona!inner(id, curp, nombres, apellido_paterno, apellido_materno, sexo, fecha_nacimiento, entidad_nacimiento, celular), cat_ocupacion(nombre), ficha_servicio_solicitado(cat_area(nombre))',
      )
      .eq('id', fichaId)
      .eq('activo', true)
      .maybeSingle();

    if (fichaError) throw fichaError;
    if (!fichaRow) return null;

    const personaRow = unwrapOne(fichaRow.persona);
    if (!personaRow) return null;

    const [domRes, estRes] = await Promise.all([
      supabase
        .from('domicilio')
        .select(
          'id, asentamiento_id, codigo_postal, calle, numero_exterior, numero_interior, referencias, zona, cat_asentamiento(nombre, codigo_postal)',
        )
        .eq('persona_id', personaRow.id)
        .eq('activo', true)
        .eq('es_actual', true)
        .maybeSingle(),
      supabase
        .from('estudio_socioeconomico')
        .select(
          'id, fecha_estudio, ingreso_mensual_propio, numero_dependientes, tiene_apoyo, especificacion_apoyo, tipo_vivienda, material, material_otro, servicios, bienes, aportante_hogar(id, nombre, tipo_trabajo, monto, frecuencia, activo, parentesco_otro, ocupacion_otra, cat_parentesco(nombre), cat_ocupacion(nombre))',
        )
        .eq('ficha_id', fichaRow.id)
        .eq('activo', true)
        .eq('es_actual', true)
        .maybeSingle(),
    ]);

    if (domRes.error) throw domRes.error;
    if (estRes.error) throw estRes.error;

    const domRow = domRes.data;
    const asentamientoRel = domRow ? unwrapOne(domRow.cat_asentamiento) : null;
    const domicilio: DomicilioDetalle | null = domRow
      ? {
          id: domRow.id,
          asentamientoId: domRow.asentamiento_id,
          asentamientoNombre: asentamientoRel?.nombre ?? null,
          codigoPostal: asentamientoRel?.codigo_postal ?? domRow.codigo_postal,
          calle: domRow.calle,
          numeroExterior: domRow.numero_exterior,
          numeroInterior: domRow.numero_interior,
          referencias: domRow.referencias,
          zona: domRow.zona,
        }
      : null;

    const estRow = estRes.data;
    const estudio: EstudioSocioeconomicoDetalle | null = estRow
      ? {
          id: estRow.id,
          fechaEstudio: estRow.fecha_estudio,
          ingresoMensualPropio: estRow.ingreso_mensual_propio,
          numeroDependientes: estRow.numero_dependientes,
          tieneApoyo: estRow.tiene_apoyo,
          especificacionApoyo: estRow.especificacion_apoyo,
          tipoVivienda: estRow.tipo_vivienda,
          material: estRow.material,
          materialOtro: estRow.material_otro,
          servicios: estRow.servicios ?? [],
          bienes: estRow.bienes ?? [],
          aportantes: (estRow.aportante_hogar ?? [])
            .filter((ap) => ap.activo)
            .map((ap) => {
              const parRel = unwrapOne(ap.cat_parentesco);
              const ocuRel = unwrapOne(ap.cat_ocupacion);
              return {
                id: ap.id,
                nombre: ap.nombre,
                parentescoNombre: parRel?.nombre ?? ap.parentesco_otro ?? null,
                ocupacionNombre: ocuRel?.nombre ?? ap.ocupacion_otra ?? null,
                tipoTrabajo: ap.tipo_trabajo,
                monto: ap.monto,
                frecuencia: ap.frecuencia,
              };
            }),
        }
      : null;

    const ocupacionRel = unwrapOne(fichaRow.cat_ocupacion);
    const serviciosSolicitados = (fichaRow.ficha_servicio_solicitado ?? [])
      .map((s) => unwrapOne(s.cat_area)?.nombre)
      .filter((n): n is string => Boolean(n));

    const sexo: SexoBiologico = personaRow.sexo === 'H' ? 'H' : 'M';

    return {
      id: fichaRow.id,
      folio: fichaRow.folio,
      estado: fichaRow.estado,
      registradaEn: fichaRow.registrada_en,
      avisoPrivacidadAceptadoEn: fichaRow.aviso_privacidad_aceptado_en,
      estadoCivil: fichaRow.estado_civil,
      ocupacionNombre: ocupacionRel?.nombre ?? null,
      servicioMedico: fichaRow.servicio_medico,
      servicioMedicoOtro: fichaRow.servicio_medico_otro,
      tieneTrabajo: fichaRow.tiene_trabajo,
      numeroHijas: fichaRow.numero_hijas,
      numeroHijosHombres: fichaRow.numero_hijos_hombres,
      tieneEmbarazo: fichaRow.tiene_embarazo,
      tieneDenuncia: fichaRow.tiene_denuncia,
      esVictimaDelito: fichaRow.es_victima_delito,
      serviciosSolicitados,
      persona: {
        id: personaRow.id,
        curp: normalizeCurp(personaRow.curp),
        nombres: personaRow.nombres,
        apellidoPaterno: personaRow.apellido_paterno,
        apellidoMaterno: personaRow.apellido_materno,
        nombreCompleto: formatFullName(
          personaRow.nombres,
          personaRow.apellido_paterno,
          personaRow.apellido_materno,
        ),
        sexo,
        fechaNacimiento: personaRow.fecha_nacimiento,
        entidadNacimiento: personaRow.entidad_nacimiento,
        celular: personaRow.celular,
      },
      domicilio,
      estudio,
    };
  },

  async archive(fichaId: string): Promise<void> {
    const { error } = await supabase
      .from('ficha_registro')
      .update({ estado: 'archivado' })
      .eq('id', fichaId);
    if (error) throw error;
  },

  async deactivate(fichaId: string): Promise<void> {
    const { error } = await supabase
      .from('ficha_registro')
      .update({ activo: false })
      .eq('id', fichaId);
    if (error) throw error;
  },
};
