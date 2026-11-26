import { supabase } from '../client';
import type { AsentamientoSepomex } from '@/domain/models/Domicilio';
import type { CatalogosFicha } from '@/domain/models/FichaRegistro';
import type { SepomexRepository } from '@/domain/ports/SepomexRepository';

export const supabaseSepomexRepository: SepomexRepository = {
  async listAsentamientos(codigoPostal?: string): Promise<AsentamientoSepomex[]> {
    let query = supabase
      .from('cat_asentamiento')
      .select('id, nombre, tipo_asentamiento, codigo_postal, municipio, estado, localidad')
      .order('nombre', { ascending: true });

    const cp = codigoPostal?.trim();
    if (cp) {
      query = query.eq('codigo_postal', cp);
    }

    const { data, error } = await query.limit(500);
    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: row.id,
      nombre: row.nombre,
      tipoAsentamiento: row.tipo_asentamiento,
      codigoPostal: row.codigo_postal,
      municipio: row.municipio,
      estado: row.estado,
      localidad: row.localidad,
    }));
  },

  async getCatalogosFicha(): Promise<CatalogosFicha> {
    const [areas, ocupaciones, parentescos] = await Promise.all([
      supabase.from('cat_area').select('id, clave, nombre').order('nombre'),
      supabase.from('cat_ocupacion').select('id, clave, nombre').order('nombre'),
      supabase.from('cat_parentesco').select('id, clave, nombre').order('nombre'),
    ]);

    for (const res of [areas, ocupaciones, parentescos]) {
      if (res.error) throw res.error;
    }

    return {
      areas: areas.data ?? [],
      ocupaciones: ocupaciones.data ?? [],
      discapacidades: [],
      gruposEtnicos: [],
      religiones: [],
      parentescos: parentescos.data ?? [],
    };
  },
};
