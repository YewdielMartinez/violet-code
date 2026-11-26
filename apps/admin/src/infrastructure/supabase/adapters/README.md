# Adaptadores de Supabase

Implementaciones de los puertos de `src/domain/ports/` usando `supabase.from()` y `supabase.rpc()`.

Reglas:

- Un archivo por puerto: `Supabase<Nombre>Repository.ts` implementa `<Nombre>Repository`.
- Solo aquí se importa `../client`. Ni `features/` ni `hooks/` lo importan.
- Traducir filas de la BD (snake_case, `database.types.ts`) a modelos de `domain/models/`.
- Lanzar el `error` de Supabase. Los hooks de TanStack Query lo manejan.

Ejemplo:

```ts
import { supabase } from '../client';
import type { InstitucionRepository } from '@/domain/ports/InstitucionRepository';

export const supabaseInstitucionRepository: InstitucionRepository = {
  async listar() {
    const { data, error } = await supabase
      .from('directorio_institucion')
      .select('id, nombre, telefono, es_24_horas')
      .order('nombre');
    if (error) throw error;
    return data.map((r) => ({ id: r.id, nombre: r.nombre, telefono: r.telefono, es24Horas: r.es_24_horas }));
  },
};
```
