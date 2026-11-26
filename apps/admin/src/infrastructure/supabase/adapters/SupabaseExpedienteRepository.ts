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

function unwrapMany<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
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

export const supabaseExpedienteRepository: ExpedienteRepository = {
  async list(query?: string): Promise<ExpedienteResumen[]> {
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

    return query?.trim() ? items.filter((item) => matchesSearch(item, query)) : items;
  },

  async verifyByCurp(rawCurp: string, allowPreRegistroLookup: boolean): Promise<VerificacionCurpResult> {
    const curp = normalizeCurp(rawCurp);

    const { data: personaRow, error: personaError } = await supabase
      .from('persona')
      .select(
        'id, curp, nombres, apellido_paterno, apellido_materno, sexo, fecha_nacimiento, entidad_nacimiento, celular, ficha_registro(id, folio, estado, creado_en, actualizado_en, activo)',
      )
      .eq('activo', true)
      .eq('curp', curp)
      .maybeSingle();

    if (personaError) throw personaError;

    if (personaRow) {
      const persona = mapPersona(personaRow);
      const activeFicha = unwrapMany(personaRow.ficha_registro)
        .filter((f) => f.activo)
        .sort((a, b) => (a.actualizado_en < b.actualizado_en ? 1 : -1))[0];

      if (activeFicha) {
        const { data: urgentRow } = await supabase
          .from('vista_lista_urgencias')
          .select('ficha_id')
          .eq('ficha_id', activeFicha.id)
          .maybeSingle();

        return {
          kind: 'expediente_existente',
          expediente: {
            id: activeFicha.id,
            folio: activeFicha.folio,
            estado: activeFicha.estado,
            creadoEn: activeFicha.creado_en,
            actualizadoEn: activeFicha.actualizado_en,
            enListaUrgencias: Boolean(urgentRow?.ficha_id),
            persona,
          },
        };
      }

      return { kind: 'persona_sin_ficha', persona };
    }

    if (allowPreRegistroLookup) {
      const { data: preRows, error: preError } = await supabase.rpc('buscar_pre_registro_por_curp', {
        p_curp: curp,
      });

      if (preError) throw preError;

      const match = Array.isArray(preRows) ? preRows[0] : null;
      if (match) {
        return {
          kind: 'pre_registro_movil',
          preRegistro: mapPreRegistroRow(match),
        };
      }
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
