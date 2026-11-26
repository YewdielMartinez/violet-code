import { supabase } from '../client';
import {
  isInternalDestino,
  type DerivacionCreateInput,
  type DerivacionItem,
  type EstadoDerivacion,
} from '@/domain/models/Derivacion';
import { formatFullName } from '@/domain/models/Persona';
import type { DerivacionRepository } from '@/domain/ports/DerivacionRepository';

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const DERIVACION_SELECT =
  'id, ficha_id, area_origen_id, area_destino_id, institucion_id, destino, institucion_otra, motivo, fecha_derivacion, estado, creado_en, ficha_registro!inner(folio, persona!inner(nombres, apellido_paterno, apellido_materno)), area_origen:cat_area!derivacion_area_origen_id_fkey(nombre), area_destino:cat_area!derivacion_area_destino_id_fkey(nombre), directorio_institucion(nombre)';

type RawRow = {
  id: string;
  ficha_id: string;
  area_origen_id: number | null;
  area_destino_id: number | null;
  institucion_id: number | null;
  destino: DerivacionItem['destino'];
  institucion_otra: string | null;
  motivo: string | null;
  fecha_derivacion: string;
  estado: EstadoDerivacion;
  creado_en: string;
  ficha_registro:
    | {
        folio: string;
        persona:
          | { nombres: string; apellido_paterno: string; apellido_materno: string | null }
          | { nombres: string; apellido_paterno: string; apellido_materno: string | null }[]
          | null;
      }
    | {
        folio: string;
        persona:
          | { nombres: string; apellido_paterno: string; apellido_materno: string | null }
          | { nombres: string; apellido_paterno: string; apellido_materno: string | null }[]
          | null;
      }[]
    | null;
  area_origen: { nombre: string } | { nombre: string }[] | null;
  area_destino: { nombre: string } | { nombre: string }[] | null;
  directorio_institucion: { nombre: string } | { nombre: string }[] | null;
};

function mapRow(row: RawRow): DerivacionItem {
  const ficha = unwrapOne(row.ficha_registro);
  const persona = ficha ? unwrapOne(ficha.persona) : null;
  const areaOrigen = unwrapOne(row.area_origen);
  const areaDestino = unwrapOne(row.area_destino);
  const institucion = unwrapOne(row.directorio_institucion);

  return {
    id: row.id,
    fichaId: row.ficha_id,
    folio: ficha?.folio ?? '—',
    usuariaNombre: persona
      ? formatFullName(persona.nombres, persona.apellido_paterno, persona.apellido_materno)
      : '—',
    areaOrigenId: row.area_origen_id,
    areaOrigenNombre: areaOrigen?.nombre ?? null,
    areaDestinoId: row.area_destino_id,
    areaDestinoNombre: areaDestino?.nombre ?? null,
    institucionId: row.institucion_id,
    institucionNombre: institucion?.nombre ?? null,
    institucionOtra: row.institucion_otra,
    destino: row.destino,
    motivo: row.motivo,
    fechaDerivacion: row.fecha_derivacion,
    estado: row.estado,
    creadoEn: row.creado_en,
  };
}

export const supabaseDerivacionRepository: DerivacionRepository = {
  async list(estado?: EstadoDerivacion): Promise<DerivacionItem[]> {
    let query = supabase
      .from('derivacion')
      .select(DERIVACION_SELECT)
      .eq('activo', true)
      .order('creado_en', { ascending: false })
      .limit(200);

    if (estado) {
      query = query.eq('estado', estado);
    }

    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as unknown as RawRow[]).map(mapRow);
  },

  async listByFicha(fichaId: string): Promise<DerivacionItem[]> {
    const { data, error } = await supabase
      .from('derivacion')
      .select(DERIVACION_SELECT)
      .eq('activo', true)
      .eq('ficha_id', fichaId)
      .order('creado_en', { ascending: false });

    if (error) throw error;
    return ((data ?? []) as unknown as RawRow[]).map(mapRow);
  },

  async create(input: DerivacionCreateInput): Promise<{ id: string }> {
    const internal = isInternalDestino(input.destino);
    const otra = input.institucionOtra.trim();

    const { data, error } = await supabase
      .from('derivacion')
      .insert({
        ficha_id: input.fichaId,
        area_origen_id: input.areaOrigenId,
        destino: input.destino,
        area_destino_id: internal ? input.areaDestinoId : null,
        institucion_id: !internal ? input.institucionId : null,
        institucion_otra: !internal && input.institucionId === null && otra ? otra : null,
        motivo: input.motivo.trim(),
      })
      .select('id')
      .single();

    if (error) throw error;
    return { id: data.id };
  },

  async updateEstado(id: string, estado: EstadoDerivacion): Promise<void> {
    const { error } = await supabase
      .from('derivacion')
      .update({ estado })
      .eq('id', id);
    if (error) throw error;
  },
};
