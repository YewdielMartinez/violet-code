# App móvil (usuaria)

[← Índice](./README.md) · Errores: [errores.md](./errores.md)

La app Kotlin habla con Supabase por HTTP (Retrofit + OkHttp en `core/data`), no con un SDK. Por eso aquí los ejemplos son peticiones HTTP a PostgREST. Las reglas de parámetros y errores son las mismas que en el resto de la referencia.

La usuaria **no** es empleada: no tiene `empleado.rol` y `tiene_permiso()` siempre le devuelve `false`. Todo lo que puede hacer se decide por **propiedad** (`auth.uid()`): su cuenta, su pre-registro y sus alertas.

---

## 0. Sesión y cabeceras

Todas las tablas y RPC están cerradas al rol `anon`. Cada petición necesita el JWT de la usuaria, no solo la *anon key*:

```http
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <access_token de la usuaria>
Content-Type: application/json
```

- El `access_token` sale de Supabase Auth (`POST /auth/v1/signup` o `POST /auth/v1/token?grant_type=password`) y se renueva con `grant_type=refresh_token`.
- Hoy el interceptor de `DataModule.kt` pone `Authorization: Bearer <anon key>` cuando la petición no trae otra. Con eso, cualquier llamada de esta página (y la lectura de `directorio_institucion`) responde `42501` o lista vacía. Hay que agregar el token de la sesión en el interceptor.
- Los errores llegan como JSON con `code`, `message`, `details` y `hint` (ver [errores.md](./errores.md)).

---

## `pre_registro` (insert)

> La usuaria se registra en la app con sus datos básicos. Es un `insert` directo sobre la tabla.

| Permiso | Quién | Tipo | Bitácora |
|---|---|---|---|
| RLS `pre_registro_insert`: `auth_user_id = auth.uid()` | Usuaria autenticada | Escritura | Sí, por trigger |

```http
POST /rest/v1/pre_registro
Prefer: return=minimal

{
  "auth_user_id": "<id de la usuaria en auth.users>",
  "curp": "TOVE960820MSLVRN03",
  "nombres": "Elena",
  "apellido_paterno": "Torres",
  "apellido_materno": "Vázquez",
  "celular": "6681000013",
  "aviso_privacidad_aceptado_en": "2026-11-26T10:00:00-07:00"
}
```

- Usa `Prefer: return=minimal`: la usuaria ya no puede hacer `select` directo de la tabla, así que `return=representation` fallaría. Para leerlo usa `get_mi_pre_registro`.
- Solo puede haber un pre-registro por cuenta (`auth_user_id` es único): un segundo intento da `23505`.
- La CURP debe cumplir el formato oficial (`23514` si no). El celular, 10 dígitos.
- Si la CURP ya tiene persona en SEMUJERES, la base los liga sola. La app **no** se entera (ver abajo).

| Código | Cuándo | Mensaje en la app |
|---|---|---|
| `42501` | Sin sesión, o `auth_user_id` distinto al de la sesión | "Inicia sesión para continuar." |
| `23505` | Ya existe un pre-registro para esta cuenta | "Ya tienes un registro. Puedes editar tus datos." |
| `23514` | CURP, nombre o celular con formato inválido | Validar antes en la app; si llega, mensaje genérico de datos inválidos. |

---

## `get_mi_pre_registro`

> Lee el pre-registro de la usuaria. A propósito **no** devuelve `persona_id` ni `estado`, para que la app no revele si esa CURP ya tenía expediente en SEMUJERES.

| Permiso | Quién | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| Propiedad `auth.uid()` | Usuaria | Lectura | No | `_27_pre_registro_seguro` |

```http
POST /rest/v1/rpc/get_mi_pre_registro
{}
```

**Respuesta** (arreglo de 0 o 1 elemento)

```json
[{
  "id": "aaaaaaaa-…-aa11",
  "curp": "TOVE960820MSLVRN03",
  "nombres": "Elena",
  "apellido_paterno": "Torres",
  "apellido_materno": "Vázquez",
  "celular": "6681000013",
  "aviso_privacidad_aceptado_en": "2026-11-25T17:00:00+00:00",
  "creado_en": "2026-11-25T17:00:00+00:00"
}]
```

- `[]` significa que la cuenta todavía no se pre-registró: muestra el formulario de alta.
- Guarda el `id`: no hace falta para enviar alertas (la base lo resuelve sola), pero sirve para la UI.

**Errores:** `42501` sin sesión.

---

## `actualizar_mi_pre_registro`

> Edita los datos que la usuaria sí puede cambiar. La CURP no se puede cambiar.

| Permiso | Quién | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| Propiedad `auth.uid()` | Usuaria | Escritura | Sí, por trigger | `_27_pre_registro_seguro` |

```http
POST /rest/v1/rpc/actualizar_mi_pre_registro
{
  "p_nombres": null,
  "p_apellido_paterno": null,
  "p_apellido_materno": "",
  "p_celular": "6681000099"
}
```

| Parámetro | Regla |
|---|---|
| `null` u omitido | Deja el valor como está. |
| `p_nombres`, `p_apellido_paterno` | 1 a 100 caracteres. |
| `p_apellido_materno` | Hasta 100. `""` lo borra. |
| `p_celular` | Exactamente 10 dígitos. `""` lo borra. |

**Respuesta:** la fila actualizada (`id`, `curp`, `nombres`, `apellido_paterno`, `apellido_materno`, `celular`, `actualizado_en`), sin `persona_id` ni `estado`.

| Código | Cuándo | Mensaje en la app |
|---|---|---|
| `42501` | Sin sesión | "Inicia sesión para continuar." |
| `23514` | No tiene pre-registro, o longitud/celular inválidos | `message` (ya viene en español) |

---

## `alerta` (insert)

> El botón de auxilio. Inserta una alerta que llega a la cola de la línea 24/7.

| Permiso | Quién | Tipo | Bitácora |
|---|---|---|---|
| RLS `alerta_insert`: `origen = 'app_movil'`, `persona_id` nulo y `pre_registro_id = mi_pre_registro_id()` | Usuaria con pre-registro | Escritura | Sí, por trigger |

```http
POST /rest/v1/alerta
Prefer: return=representation

{
  "origen": "app_movil",
  "pre_registro_id": "<id de get_mi_pre_registro>",
  "asentamiento_id": 1234
}
```

- `pre_registro_id` debe ser el suyo; cualquier otro da `42501`. No mandes `persona_id`.
- La prioridad la pone la base: toda alerta de la app entra como `media`, y sube a `alta` si la persona ligada tiene orden de protección vigente. Lo que mande la app en `prioridad` se ignora.
- `asentamiento_id` es opcional; si se manda, alimenta el mapa de calor.
- Sin pre-registro no se puede enviar alerta: primero el alta.
- Con `return=representation` sí regresa la fila, porque la usuaria puede leer sus propias alertas.

**Seguir el estado de su alerta:** `GET /rest/v1/alerta?select=id,estado,creado_en,tomada_en,atendida_en&order=creado_en.desc` devuelve solo las suyas. También puede suscribirse por Realtime a `alerta` y recibirá solo los cambios de las suyas.

| Código | Cuándo | Mensaje en la app |
|---|---|---|
| `42501` | Sin sesión, sin pre-registro, o `pre_registro_id` ajeno | "No pudimos enviar tu alerta. Llama al 911." |
| Red / 5xx | Sin conexión | Mostrar el botón de llamada directa y reintentar. |

> En el botón de auxilio, cualquier fallo debe ofrecer la llamada al 911 o a la línea de SEMUJERES, no solo un mensaje de error.

---

## Lo que la app no puede hacer

- Leer `persona`, `ficha_registro`, `cita` ni nada del expediente.
- Leer `pre_registro` con `select` directo (usa `get_mi_pre_registro`).
- Saber si su CURP ya tenía expediente.
- Leer alertas de otras usuarias.
