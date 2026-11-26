# Módulo de Geografía y Códigos Postales (SEPOMEX)

Documentación técnica de la estructura geográfica de `public.cat_asentamiento`, su precarga inicial y el patrón de consumo para **Admin** y **Móvil**.

---

## 1. Modelo y principios de diseño

1. **Catálogo local autónomo (*Zero-Network*):** los asentamientos oficiales de SEPOMEX residen en PostgreSQL (`cat_asentamiento`), eliminando dependencias de APIs externas en tiempo real y errores tipográficos por captura manual.
2. **Escalabilidad nacional desde el día 1:** `cat_asentamiento.id` y todas sus llaves foráneas (`domicilio.asentamiento_id`, `agresor.asentamiento_id`, `directorio_institucion.asentamiento_id`, `alerta.asentamiento_id`, `actividad_preventiva.asentamiento_id`) usan **`integer` (`int4`)** para soportar sin rediseño tanto la precarga municipal como el catálogo nacional completo (`158,864` asentamientos).
3. **Cobertura para personas foráneas sin redundancia de CP:** en `domicilio`, `agresor` y `directorio_institucion`, `asentamiento_id` es nullable; si el domicilio proviene de otro municipio o estado fuera de la precarga local, el registro no se bloquea y conserva los campos estructurados (`calle`, `numero_exterior`, `numero_interior`, `referencias`) más `codigo_postal` (`CHECK` de 5 dígitos) como respaldo (`check (asentamiento_id is null or codigo_postal is null)`).
4. **Caché bajo demanda:** los clientes consultan por código postal o municipio bajo demanda (sin descargar el catálogo completo a `IndexedDB` ni al bundle).

---

## 2. Estructura de `cat_asentamiento`

| Columna | Tipo | Restricción / Índice | Descripción |
|---|---|---|---|
| `id` | `integer` | `PRIMARY KEY GENERATED ALWAYS AS IDENTITY` | Identificador único del asentamiento. |
| `codigo_postal` | `text` | `NOT NULL`, `CHECK (codigo_postal ~ '^[0-9]{5}$')`, índice `btree` | Código postal de 5 dígitos. |
| `nombre` | `text` | `NOT NULL` | Nombre oficial de la colonia/asentamiento. |
| `tipo_asentamiento` | `text` | `NOT NULL` | Tipo oficial (`Colonia`, `Fraccionamiento`, `Ejido`, `Ranchería`, etc.). |
| `municipio` | `text` | `NOT NULL`, índice `btree (estado, municipio)` | Municipio o alcaldía. |
| `estado` | `text` | `NOT NULL`, índice `btree (estado, municipio)` | Entidad federativa. |
| `localidad` | `text` | Nullable | Ciudad o localidad (admite `NULL` en asentamientos rurales). |
| `latitud`, `longitud` | `numeric(9, 6)` | Nullable | Coordenadas opcionales de referencia para mapa de calor. |

Unicidad compuesta: `unique (codigo_postal, nombre, tipo_asentamiento, municipio, estado)`.

---

## 3. Alcance de carga y escalamiento

- **Entorno actual (Ahome, Sinaloa):** [20261125000150_01b_sepomex_ahome.sql](../migrations/20261125000150_01b_sepomex_ahome.sql) precarga **`451` asentamientos** correspondientes a **`97` códigos postales únicos** de Ahome.
- **Escalamiento estatal / nacional:** para ampliar a todo Sinaloa (`4,561` registros) o todo México (`158,864` registros), basta cargar el catálogo sanitizado vía `\copy` o migración dedicada sin modificar tablas ni consultas en clientes.

---

## 4. Patrón de consumo recomendado en Frontend

Configurar en **TanStack Query** un `staleTime` prolongado (ej. `24h`) para evitar consultas repetidas.

### A. Captura rápida por Código Postal (*CP-First*)
```ts
const { data, error } = await supabase
  .from('cat_asentamiento')
  .select('id, codigo_postal, nombre, tipo_asentamiento, municipio, estado, localidad')
  .eq('codigo_postal', cp)
  .order('nombre');
```
- Autocompleta **Estado**, **Municipio** y **Localidad** en solo lectura/referencia.
- Llena el selector de **Colonia** (si hay 1 único resultado, lo selecciona automáticamente).

### B. Captura en cascada (cuando no conocen el CP)
```ts
const { data, error } = await supabase
  .from('cat_asentamiento')
  .select('id, codigo_postal, nombre, tipo_asentamiento, localidad')
  .eq('estado', estado)
  .eq('municipio', municipio)
  .order('nombre');
```
- Al seleccionar la colonia, el formulario deduce y asigna automáticamente `codigo_postal` y `localidad`.
