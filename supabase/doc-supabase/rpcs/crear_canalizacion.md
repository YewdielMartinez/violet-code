# RPC: `public.crear_canalizacion`

- **Versión:** [`20261127000200_33`](../../migrations/20261127000200_33_rpc_crear_canalizacion.sql)
- **Migración:** `supabase/migrations/20261127000200_33_rpc_crear_canalizacion.sql`
- **Cubre:** `RF-08`, `RN-01`, `RN-03`, `RN-11` (Sprint 02 · A-01)

## Actores autorizados
- Exclusivo de **`trabajo_social`** activo (`tiene_permiso('canalizacion.crear')`).
- `titular`, `subdireccion`, `psicologia`, `juridico`, `recepcion`, `umeca`, usuaria de la app, empleados inactivos y sesiones sin autenticar son rechazados con `42501`.
- El `area_origen_id` se obtiene siempre del actor en sesión (`auth_area_id()`); el cliente no lo envía.

## Entrada
```ts
{
  p_ficha_id: string;
  p_destino: DestinoDerivacion;           // 'trabajo_social' | 'psicologia' | 'juridico' | 'fiscalia' | 'refugio' | 'capacitacion' | 'otra_institucion'
  p_area_destino_id?: number | null;      // Obligatorio en destinos internos; null en externos
  p_institucion_id?: number | null;       // Opcional en externos (mutuamente excluyente con p_institucion_otra)
  p_institucion_otra?: string | null;     // Máx. 200 caracteres; obligatorio en 'otra_institucion' si p_institucion_id es null
  p_motivo?: string | null;               // Máx. 1000 caracteres
}
```

## Salida
Fila única con:
- `derivacion_id`: `uuid` de la canalización creada.
- `estado`: `'pendiente'`.
- `aviso`: `text | null` (aviso no bloqueante `RN-03` si la persona tiene `sexo = 'H'` y el destino no es jurídico ni externo).

## Errores
- `42501`: actor distinto de `trabajo_social` activo, sin sesión o sin `area_id`.
- `23514`: expediente inexistente/inactivo/archivado, combinación inválida de destino vs área/institución, institución inexistente/inactiva, longitudes excedidas o menor de 18 años hacia Psicología/Jurídico (`RN-01`).
