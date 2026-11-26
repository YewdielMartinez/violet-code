import type { CategoriaInstitucion, DirectorioInstitucion } from '../models/Directorio';

export interface DirectorioRepository {
  listar(categoria?: CategoriaInstitucion): Promise<DirectorioInstitucion[]>;
}
