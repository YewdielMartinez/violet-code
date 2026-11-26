import { supabase } from '../client';
import type { CategoriaInstitucion, DirectorioInstitucion } from '@/domain/models/Directorio';
import type { DirectorioRepository } from '@/domain/ports/DirectorioRepository';

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export const supabaseDirectorioRepository: DirectorioRepository = {
  async listar(categoria?: CategoriaInstitucion): Promise<DirectorioInstitucion[]> {
    let query = supabase
      .from('directorio_institucion')
      .select(
        'id, nombre, categoria, telefono, horario, es_24_horas, calle, numero_exterior, numero_interior, codigo_postal, orden, cat_asentamiento(nombre)',
      )
      .eq('activo', true)
      .order('orden', { ascending: true })
      .order('nombre', { ascending: true });

    if (categoria) {
      query = query.eq('categoria', categoria);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((row) => {
      const asentamiento = unwrapOne(row.cat_asentamiento);
      // Nunca exponer domicilio/ubicación de refugios confidenciales.
      const direccion =
        row.categoria === 'refugio'
          ? null
          : [row.calle, row.numero_exterior, row.numero_interior, asentamiento?.nombre, row.codigo_postal]
              .filter(Boolean)
              .join(', ') || null;

      return {
        id: row.id,
        nombre: row.nombre,
        categoria: row.categoria,
        telefono: row.telefono,
        horario: row.horario,
        es24Horas: row.es_24_horas,
        direccion,
        orden: row.orden,
      };
    });
  },
};
