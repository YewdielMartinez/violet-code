import { supabase } from '../client';
import type { Json } from '../database.types';
import type { DomicilioDetalle } from '@/domain/models/Domicilio';
import type { EstudioSocioeconomicoDetalle } from '@/domain/models/EstudioSocioeconomico';
import type { FichaCompletaDetalle, FichaCreateInput } from '@/domain/models/FichaRegistro';
import { formatFullName, normalizeCurp, type SexoBiologico } from '@/domain/models/Persona';
import type { CreatedFichaResult, FichaRepository } from '@/domain/ports/FichaRepository';

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export const supabaseFichaRepository: FichaRepository = {
  async createComplete(input: FichaCreateInput): Promise<CreatedFichaResult> {
    const payload: FichaCreateInput = {
      ...input,
      identidad: {
        ...input.identidad,
        curp: normalizeCurp(input.identidad.curp),
      },
    };

    const { data, error } = await supabase.rpc('crear_ficha_completa', {
      p_payload: payload as unknown as Json,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('El servidor no devolvió el folio del expediente creado.');
    }

    return {
      fichaId: row.ficha_id,
      folio: row.folio,
      personaId: row.persona_id,
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
