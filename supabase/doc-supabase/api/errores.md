# Errores: qué significan y qué mostrar

[← Índice](./README.md)

Cuando una RPC o una operación `.from()` falla, `supabase-js` devuelve `error` con esta forma:

```ts
interface PostgrestError {
  code: string;     // SQLSTATE ('42501', '23514', ...) o código de PostgREST ('PGRST202', ...)
  message: string;  // texto del raise exception (en las RPC del proyecto ya viene en español para la usuaria)
  details: string | null;
  hint: string | null;
}
```

Las RPC del proyecto solo lanzan tres códigos a propósito: `42501`, `23514` y `23505` (estándar §3.2). Los demás vienen de Postgres, de RLS o de PostgREST.

---

## 1. Códigos y mensaje para la UI

| Código | HTTP | Qué significa | Qué mostrar | ¿Usar `error.message`? |
|---|---|---|---|---|
| `42501` | 401/403 | Sin sesión, empleado inactivo, rol sin permiso o registro fuera de su área. También lo da RLS cuando un `insert`/`update` no pasa la política. | "No tienes permiso para realizar esta acción." | **No.** Muestra el mensaje fijo; el texto técnico no ayuda a la usuaria. |
| `23514` | 400 | Regla de negocio o dato inválido: CURP con formato malo, fecha pasada, transición de estado no permitida, límite fuera de rango, registro inexistente o inactivo. | El texto de `error.message`. | **Sí.** Las RPC lo escriben para mostrarse ("La nueva fecha de la cita debe estar en el futuro"). |
| `23505` | 409 | Duplicado o conflicto: CURP con expediente, cita ya reagendada, alerta ya tomada por otra persona, cita que ya tiene hoja de seguimiento. | El texto de `error.message` y, si aplica, refrescar la lista. | **Sí.** |
| `23503` | 409 | Llave foránea inválida (un catálogo o registro que no existe). Viene de `.from()`, no de las RPC. | "Un dato seleccionado ya no existe. Recarga e intenta de nuevo." | No. |
| `P0001` | 400 | `raise exception` sin código. No debería salir de las RPC nuevas; si sale, es un bug del SQL. | El texto de `error.message`. | Sí, y reportarlo. |
| `PGRST202` | 404 | La RPC no existe con esos parámetros: nombre mal escrito, parámetro de más o de menos, o la migración no se aplicó. | "No se pudo completar la operación." | No. Es error de programación: revisa el nombre de parámetros y los tipos generados. |
| `PGRST203` | 300 | Hay dos versiones de la función y PostgREST no sabe cuál usar. | "No se pudo completar la operación." | No. Es un problema de la migración. |
| `PGRST116` | 406 | Usaste `.single()` y la respuesta trajo 0 o más de 1 fila. | Depende: "No se encontró el registro." | No. |
| `PGRST301` / `PGRST303` | 401 | JWT vencido o inválido. | Cerrar sesión y mandar al login. | No. |
| Otro / sin código | 500 | Error inesperado o de red. | "No se pudo completar la operación. Intenta de nuevo." | No. |

---

## 2. Helper sugerido

Hoy cada adaptador tiene su propio `mapSupabaseError` (por ejemplo en `SupabaseAgresorRepository.ts`). Para las RPC nuevas conviene uno compartido en `infrastructure/supabase/errors.ts`:

```ts
import type { PostgrestError } from '@supabase/supabase-js';

export class RpcError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

const MENSAJES_FIJOS: Record<string, string> = {
  '42501': 'No tienes permiso para realizar esta acción.',
  '23503': 'Un dato seleccionado ya no existe. Recarga e intenta de nuevo.',
  PGRST116: 'No se encontró el registro.',
  PGRST301: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  PGRST303: 'Tu sesión expiró. Vuelve a iniciar sesión.',
};

const CODIGOS_CON_MENSAJE_DE_NEGOCIO = new Set(['23514', '23505', 'P0001']);

export function traducirErrorRpc(error: PostgrestError, porDefecto = 'No se pudo completar la operación. Intenta de nuevo.'): RpcError {
  if (CODIGOS_CON_MENSAJE_DE_NEGOCIO.has(error.code) && error.message) {
    return new RpcError(error.message, error.code);
  }
  return new RpcError(MENSAJES_FIJOS[error.code] ?? porDefecto, error.code);
}
```

En el hook, `onError` puede mirar `error.code` para decidir algo más que el mensaje:

- `23505` en `tomar_alerta`: refrescar la cola (`invalidateQueries(['alertas','cola'])`) porque otra persona ya la tomó.
- `23505` en `crear_ficha_completa`: el mensaje trae el folio; ofrecer abrir el expediente existente.
- `42501` en una pantalla completa: mostrar la vista de "sin acceso" en lugar de un toast.

---

## 3. Errores que no son error

- Una RPC de lista sin resultados devuelve `data = []`, no error.
- `get_informe` sin atenciones en el periodo devuelve `[]`.
- `get_mi_pre_registro` sin pre-registro devuelve `[]`.
- Un `.from().select()` que RLS no deja ver devuelve `[]`, **no** `42501`. Solo los `insert`/`update` rechazados por RLS dan `42501`. Por eso las pantallas de lista basadas en `.from()` no pueden distinguir "no hay datos" de "no tienes permiso".
