import type { OrdenProteccion, OrdenProteccionInput } from '@/domain/models/OrdenProteccion';
import type { OrdenProteccionRepository } from '@/domain/ports/OrdenProteccionRepository';
import { supabase } from '../client';
import {
  mapOrdenProteccionRow,
  toOrdenProteccionInsert,
  toOrdenProteccionUpdate,
  traducirErrorOrdenProteccion,
} from './ordenProteccion.mapper';

const ORDEN_SELECT =
  'id, ficha_id, agresor_id, numero_oficio, autoridad_emisora, fecha_emision, fecha_vigencia, estado, activo, creado_en, actualizado_en';

export const supabaseOrdenProteccionRepository: OrdenProteccionRepository = {
  async listarPorFicha(fichaId: string): Promise<OrdenProteccion[]> {
    const { data, error } = await supabase
      .from('orden_proteccion')
      .select(ORDEN_SELECT)
      .eq('ficha_id', fichaId)
      .eq('activo', true)
      .order('fecha_emision', { ascending: false })
      .order('creado_en', { ascending: false });

    if (error) {
      throw traducirErrorOrdenProteccion(error, 'No se pudieron cargar las órdenes de protección.');
    }

    return (data ?? []).map((row) => mapOrdenProteccionRow(row));
  },

  async crear(input: OrdenProteccionInput): Promise<OrdenProteccion> {
    const { data, error } = await supabase
      .from('orden_proteccion')
      .insert(toOrdenProteccionInsert(input))
      .select(ORDEN_SELECT)
      .single();

    if (error) {
      throw traducirErrorOrdenProteccion(error, 'No se pudo registrar la orden de protección.');
    }

    return mapOrdenProteccionRow(data);
  },

  async actualizar(id: string, input: OrdenProteccionInput): Promise<OrdenProteccion> {
    let query = supabase
      .from('orden_proteccion')
      .update(toOrdenProteccionUpdate(input))
      .eq('id', id)
      .eq('activo', true);

    if (input.actualizadoEnEsperado) {
      query = query.eq('actualizado_en', input.actualizadoEnEsperado);
    }

    const { data, error } = await query.select(ORDEN_SELECT).maybeSingle();

    if (error) {
      throw traducirErrorOrdenProteccion(error, 'No se pudo actualizar la orden de protección.');
    }

    if (!data) {
      throw new Error(
        'Esta orden de protección fue modificada por otra compañera. Recarga los datos antes de guardar.',
      );
    }

    return mapOrdenProteccionRow(data);
  },

  async desactivar(id: string, actualizadoEnEsperado?: string): Promise<void> {
    let query = supabase
      .from('orden_proteccion')
      .update({ activo: false })
      .eq('id', id)
      .eq('activo', true);

    if (actualizadoEnEsperado) {
      query = query.eq('actualizado_en', actualizadoEnEsperado);
    }

    const { data, error } = await query.select('id').maybeSingle();

    if (error) {
      throw traducirErrorOrdenProteccion(error, 'No se pudo archivar la orden de protección.');
    }

    if (!data) {
      throw new Error(
        'La orden de protección no existe o fue modificada por otra compañera.',
      );
    }
  },
};
