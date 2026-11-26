import { supabase } from '../client';
import {
  detectSearchKind,
  formatFullName,
  normalizeCurp,
  type ExpedienteResumen,
  type PersonaResumen,
  type SexoBiologico,
} from '@/domain/models/Persona';
import { mapPreRegistroRow, type VerificacionCurpResult } from '@/domain/models/PreRegistroMovil';
import type { ExpedienteRepository } from '@/domain/ports/ExpedienteRepository';

interface PersonaRowShape {
  id: string;
  curp: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  sexo: string;
  fecha_nacimiento: string;
  entidad_nacimiento: string;
  celular: string | null;
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function mapPersona(row: PersonaRowShape): PersonaResumen {
  const sexo: SexoBiologico = row.sexo === 'H' ? 'H' : 'M';
  return {
    id: row.id,
    curp: normalizeCurp(row.curp),
    nombres: row.nombres,
    apellidoPaterno: row.apellido_paterno,
    apellidoMaterno: row.apellido_materno,
    nombreCompleto: formatFullName(row.nombres, row.apellido_paterno, row.apellido_materno),
    sexo,
    fechaNacimiento: row.fecha_nacimiento,
    entidadNacimiento: row.entidad_nacimiento,
    celular: row.celular,
  };
}

function buildFallbackPersona(id: string, curp: string, nombreCompleto: string | null): PersonaResumen {
  const cleanCurp = normalizeCurp(curp);
  const sexo: SexoBiologico = cleanCurp[10] === 'H' ? 'H' : 'M';
  return {
    id,
    curp: cleanCurp,
    nombres: nombreCompleto?.trim() || 'Persona registrada',
    apellidoPaterno: '',
    apellidoMaterno: null,
    nombreCompleto: nombreCompleto?.trim() || 'Persona registrada',
    sexo,
    fechaNacimiento: '',
    entidadNacimiento: cleanCurp.slice(11, 13),
    celular: null,
  };
}

function matchesSearch(item: ExpedienteResumen, rawQuery: string): boolean {
  const trimmed = rawQuery.trim();
  if (!trimmed) return true;

  const kind = detectSearchKind(trimmed);
  if (kind === 'curp') {
    return item.persona.curp === normalizeCurp(trimmed);
  }
  if (kind === 'folio') {
    return item.folio.toUpperCase().includes(trimmed.toUpperCase());
  }

  const tokens = normalizeText(trimmed).split(/\s+/).filter(Boolean);
  const haystack = normalizeText(`${item.persona.nombreCompleto} ${item.persona.curp} ${item.folio}`);
  return tokens.every((token) => haystack.includes(token));
}

async function fetchPersonaDetail(
  personaId: string | null,
  curp: string,
  nombreCompleto: string | null,
): Promise<PersonaResumen> {
  if (!personaId) {
    return buildFallbackPersona('', curp, nombreCompleto);
  }

  const { data: personaRow, error } = await supabase
    .from('persona')
    .select('id, curp, nombres, apellido_paterno, apellido_materno, sexo, fecha_nacimiento, entidad_nacimiento, celular')
    .eq('id', personaId)
    .eq('activo', true)
    .maybeSingle();

  if (error) throw error;
  return personaRow ? mapPersona(personaRow) : buildFallbackPersona(personaId, curp, nombreCompleto);
}

export const supabaseExpedienteRepository: ExpedienteRepository = {
  async list(query?: string): Promise<ExpedienteResumen[]> {
    const trimmed = query?.trim() ?? '';

    if (trimmed.length >= 3) {
      const { data, error } = await supabase.rpc('buscar_expedientes', {
        p_termino: trimmed,
        p_limite: 100,
        p_incluir_archivados: true,
      });

      if (error) throw error;

      return (data ?? []).map((row) => {
        const curp = normalizeCurp(row.curp);
        return {
          id: row.ficha_id,
          folio: row.folio,
          estado: row.estado,
          creadoEn: '',
          actualizadoEn: '',
          enListaUrgencias: row.en_lista_urgencias,
          persona: {
            id: row.persona_id,
            curp,
            nombres: row.nombre_completo,
            apellidoPaterno: '',
            apellidoMaterno: null,
            nombreCompleto: row.nombre_completo,
            sexo: row.sexo === 'H' ? 'H' : 'M',
            fechaNacimiento: row.fecha_nacimiento,
            entidadNacimiento: curp.slice(11, 13),
            celular: null,
          },
        };
      });
    }

    const [fichasRes, urgenciasRes] = await Promise.all([
      supabase
        .from('ficha_registro')
        .select(
          'id, folio, estado, creado_en, actualizado_en, persona!inner(id, curp, nombres, apellido_paterno, apellido_materno, sexo, fecha_nacimiento, entidad_nacimiento, celular)',
        )
        .eq('activo', true)
        .order('actualizado_en', { ascending: false })
        .limit(200),
      supabase.from('vista_lista_urgencias').select('ficha_id'),
    ]);

    if (fichasRes.error) throw fichasRes.error;

    const urgentIds = new Set(
      (urgenciasRes.data ?? [])
        .map((row) => row.ficha_id)
        .filter((id): id is string => typeof id === 'string'),
    );

    const items: ExpedienteResumen[] = [];
    for (const row of fichasRes.data ?? []) {
      const personaRow = unwrapOne(row.persona);
      if (!personaRow) continue;
      items.push({
        id: row.id,
        folio: row.folio,
        estado: row.estado,
        creadoEn: row.creado_en,
        actualizadoEn: row.actualizado_en,
        enListaUrgencias: urgentIds.has(row.id),
        persona: mapPersona(personaRow),
      });
    }

    return trimmed ? items.filter((item) => matchesSearch(item, trimmed)) : items;
  },

  async verifyByCurp(rawCurp: string, allowPreRegistroLookup: boolean): Promise<VerificacionCurpResult> {
    const curp = normalizeCurp(rawCurp);

    const { data: verifyRows, error: verifyError } = await supabase.rpc('verificar_curp', {
      p_curp: curp,
    });

    if (verifyError) throw verifyError;

    const verifyRow = Array.isArray(verifyRows) ? verifyRows[0] : verifyRows;
    if (!verifyRow || verifyRow.resultado === 'nuevo') {
      return { kind: 'nuevo', curp };
    }

    if (verifyRow.resultado === 'pre_registro_movil') {
      if (!allowPreRegistroLookup) {
        return { kind: 'nuevo', curp };
      }

      const { data: preRows, error: preError } = await supabase.rpc('buscar_pre_registro_por_curp', {
        p_curp: curp,
      });

      if (preError) throw preError;

      const match = Array.isArray(preRows) ? preRows[0] : null;
      return match ? { kind: 'pre_registro_movil', preRegistro: mapPreRegistroRow(match) } : { kind: 'nuevo', curp };
    }

    if (verifyRow.resultado === 'expediente_existente') {
      const fichaId = verifyRow.ficha_id;
      // Independientes: persona y pertenencia a la lista de urgencias se consultan en paralelo.
      const [persona, enListaUrgencias] = await Promise.all([
        fetchPersonaDetail(verifyRow.persona_id, curp, verifyRow.nombre_completo),
        fichaId
          ? supabase
              .from('vista_lista_urgencias')
              .select('ficha_id')
              .eq('ficha_id', fichaId)
              .maybeSingle()
              .then(({ data: urgentRow }) => Boolean(urgentRow?.ficha_id))
          : false,
      ]);

      return {
        kind: 'expediente_existente',
        expediente: {
          id: verifyRow.ficha_id ?? '',
          folio: verifyRow.folio ?? '—',
          estado: verifyRow.estado ?? 'abierto',
          creadoEn: '',
          actualizadoEn: '',
          enListaUrgencias,
          persona,
        },
      };
    }

    if (verifyRow.resultado === 'persona_sin_ficha') {
      const persona = await fetchPersonaDetail(verifyRow.persona_id, curp, verifyRow.nombre_completo);
      return { kind: 'persona_sin_ficha', persona };
    }

    return { kind: 'nuevo', curp };
  },

  async registerConsult(fichaId: string): Promise<void> {
    const { error } = await supabase.rpc('registrar_consulta', {
      p_tabla: 'ficha_registro',
      p_registro_id: fichaId,
    });
    if (error) throw error;
  },
};
