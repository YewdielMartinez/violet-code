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
  toAgresorInsert,
  toAgresorUpdate,
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
    const { data, error } = await supabase
      .from('agresor')
      .insert(toAgresorInsert(input))
      .select(AGRESOR_SELECT)
      .single();

    if (error) throw mapSupabaseError(error);
    return mapAgresorRow(data);
  },

  async actualizar(id: string, input: AgresorInput): Promise<Agresor> {
    let query = supabase
      .from('agresor')
      .update(toAgresorUpdate(input))
      .eq('id', id)
      .eq('activo', true);

    if (input.actualizadoEnEsperado) {
      query = query.eq('actualizado_en', input.actualizadoEnEsperado);
    }

    const { data, error } = await query.select(AGRESOR_SELECT).maybeSingle();

    if (error) throw mapSupabaseError(error);
    if (!data) {
      throw new Error(
        'Este registro fue modificado por otra compañera. Recarga los datos antes de guardar.',
      );
    }
    return mapAgresorRow(data);
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
