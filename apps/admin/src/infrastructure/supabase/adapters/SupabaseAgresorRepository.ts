import type {
  Agresor,
  AgresorInput,
  AsentamientoOpcion,
  CatalogoOpcion,
} from '@/domain/models/Agresor';
import type {
  AgresorRepository,
  TablaConsultaAgresor,
} from '@/domain/ports/AgresorRepository';
import { supabase } from '../client';
import { mapSupabaseError } from './errors';
import {
  mapAgresorRow,
  mapAsentamientoRow,
  mapCatalogoRow,
  toGuardarAgresorArgs,
} from './agresor.mapper';

const AGRESOR_SELECT =
  'id, ficha_id, nombres, apellido_paterno, apellido_materno, parentesco_id, parentesco_otro, asentamiento_id, codigo_postal, calle, numero_exterior, numero_interior, referencias, ocupacion_id, ocupacion_otra, drogas, especificacion_droga, especificacion_arma, observaciones, activo, actualizado_en';

export const supabaseAgresorRepository: AgresorRepository = {
  async listarPorFicha(fichaId: string): Promise<Agresor[]> {
    const { data, error } = await supabase
      .from('agresor')
      .select(AGRESOR_SELECT)
      .eq('ficha_id', fichaId)
      .eq('activo', true)
      .order('creado_en', { ascending: true });

    if (error) throw mapSupabaseError(error);
    return (data ?? []).map(mapAgresorRow);
  },

  async crear(input: AgresorInput): Promise<Agresor> {
    const { data, error } = await supabase.rpc('guardar_agresor', toGuardarAgresorArgs(input));

    if (error) throw mapSupabaseError(error);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('El servidor no devolvió el registro de la persona agresora.');
    }
    return mapAgresorRow(row);
  },

  async actualizar(id: string, input: AgresorInput): Promise<Agresor> {
    const { data, error } = await supabase.rpc('guardar_agresor', toGuardarAgresorArgs(input, id));

    if (error) throw mapSupabaseError(error);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('El servidor no devolvió el registro actualizado de la persona agresora.');
    }
    return mapAgresorRow(row);
  },

  async desactivar(id: string, motivo?: string | null): Promise<void> {
    const { error } = await supabase.rpc('desactivar_agresor', {
      p_agresor_id: id,
      p_motivo: motivo?.trim() || undefined,
    });
    if (error) throw mapSupabaseError(error);
  },

  async registrarConsulta(tabla: TablaConsultaAgresor, registroId: string): Promise<void> {
    const { error } = await supabase.rpc('registrar_consulta', {
      p_tabla: tabla,
      p_registro_id: registroId,
    });
    if (error) throw mapSupabaseError(error);
  },

  async listarParentescos(): Promise<CatalogoOpcion[]> {
    const { data, error } = await supabase
      .from('cat_parentesco')
      .select('id, clave, nombre')
      .order('id', { ascending: true });

    if (error) throw mapSupabaseError(error);
    return (data ?? []).map(mapCatalogoRow);
  },

  async listarOcupaciones(): Promise<CatalogoOpcion[]> {
    const { data, error } = await supabase
      .from('cat_ocupacion')
      .select('id, clave, nombre')
      .order('id', { ascending: true });

    if (error) throw mapSupabaseError(error);
    return (data ?? []).map(mapCatalogoRow);
  },

  async listarAsentamientosAhome(): Promise<AsentamientoOpcion[]> {
    const { data, error } = await supabase
      .from('cat_asentamiento')
      .select('id, nombre, tipo_asentamiento, codigo_postal, localidad')
      .eq('municipio', 'Ahome')
      .order('nombre', { ascending: true })
      .limit(1000);

    if (error) throw mapSupabaseError(error);
    return (data ?? []).map(mapAsentamientoRow);
  },
};
