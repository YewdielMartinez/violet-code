import { supabase } from '../client';
import type { AsentamientoSepomex } from '@/domain/models/Domicilio';
import type { CatalogoItem, CatalogosFicha } from '@/domain/models/FichaRegistro';
import type { CatalogoNombre, SepomexRepository } from '@/domain/ports/SepomexRepository';

const CATALOGO_TABLES = {
  area: 'cat_area',
  ocupacion: 'cat_ocupacion',
  parentesco: 'cat_parentesco',
} as const satisfies Record<CatalogoNombre, string>;

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
      supabaseSepomexRepository.listCatalogo('area'),
      supabaseSepomexRepository.listCatalogo('ocupacion'),
      supabaseSepomexRepository.listCatalogo('parentesco'),
    ]);
    return { areas, ocupaciones, parentescos };
  },

  async listCatalogo(catalogo: CatalogoNombre): Promise<CatalogoItem[]> {
    const { data, error } = await supabase
      .from(CATALOGO_TABLES[catalogo])
      .select('id, clave, nombre')
      .order('nombre');
    if (error) throw error;
    return data ?? [];
  },
};
