-- =====================================================================
-- 01_base.sql
-- Qué contiene: áreas, colonias, empleados, personas atendidas y domicilios.
-- Es la base de la que cuelgan las demás tablas (cita, seguimiento, alerta...).
-- Responsable: Sara
--
-- REGLAS DEL EQUIPO
-- Sirven para que las dos escribamos igual y las tablas se puedan unir
-- sin sorpresas.
--
-- 1. NOMBRES
--    Todo en minúsculas y con guion bajo (snake_case), en español, sin
--    acentos ni eñ. Ejemplos: fecha_nacimiento, apellido_paterno, anio.
--    Las tablas van en singular: persona, cita, alerta (no "personas").
--    Los catálogos (listas fijas, como las áreas) empiezan con cat_:
--    cat_area.
--
-- 2. LLAVE PRIMARIA (lo que identifica cada fila)
--    Siempre se llama id.
--    Tablas normales:    id uuid default gen_random_uuid()  (se genera sola)
--    Catálogos chicos:   id smallint con identity           (1, 2, 3...)
--
-- 3. LLAVE FORÁNEA (la columna que apunta a otra tabla)
--    Se llama <tabla a la que apunta>_id: persona_id, colonia_id, area_id.
--    Debe ser del MISMO tipo que el id al que apunta (uuid con uuid,
--    smallint con smallint); si no, Supabase marca error.
--    Si una tabla apunta dos veces a la misma, el nombre dice el papel:
--    creado_por, atendida_por (ambas apuntan a empleado).
--
-- 4. TIPOS DE DATOS
--    Texto: text (nunca varchar).   Fecha sola: date.
--    Fecha con hora: timestamptz.   Dinero: numeric(10, 2).
--    Sí/no: boolean.
--
-- 5. NOMBRE DEL CAMPO SEGÚN SU TIPO
--    Sí/no:          empieza con es_ o tiene_   (es_primera_vez, tiene_embarazo)
--    Fecha sola:     empieza con fecha_         (fecha_nacimiento)
--    Fecha con hora: termina en _en             (creado_en, confirmada_en)
--
-- 6. CAMPOS QUE LLEVAN LAS TABLAS DE DATOS
--    creado_en       cuándo se registró (se llena sola)
--    actualizado_en  última modificación (se llena sola con el trigger de
--                    más abajo; en cada tabla nueva se copia el trigger)
--    creado_por      qué empleado lo registró (apunta a empleado)
--
-- 7. NO SE BORRA NADA
--    Las llaves foráneas llevan on delete restrict: la base no deja borrar
--    una persona que ya tiene citas. Para dar de baja se pone activo = false.
--
-- 8. ORDEN DE LOS ARCHIVOS
--    01_base -> 02_... -> 03_... -> 04_politicas -> 05_seed
--    Si hay que corregir una tabla que ya existe, se crea un archivo nuevo
--    con ALTER TABLE; no se edita el viejo para volver a correrlo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Trigger compartido: cada vez que se modifica una fila, actualiza
-- actualizado_en. Se crea una sola vez; en cada tabla solo se agrega
-- el "create trigger" con su nombre.
-- ---------------------------------------------------------------------
create or replace function set_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- cat_area: las tres áreas de atención. Es el ejemplo de catálogo: los
-- demás siguen el mismo patrón (id, clave, nombre).
-- ---------------------------------------------------------------------
create table cat_area (
  id     smallint generated always as identity primary key,
  clave  text not null unique,
  nombre text not null
);

insert into cat_area (clave, nombre) values
  ('trabajo_social', 'Trabajo Social'),
  ('psicologia',     'Psicología'),
  ('juridico',       'Jurídico');

-- ---------------------------------------------------------------------
-- colonia: catálogo para el mapa de calor (colonia o sindicatura).
-- ---------------------------------------------------------------------
create table colonia (
  id       smallint generated always as identity primary key,
  nombre   text not null,
  tipo     text not null default 'colonia' check (tipo in ('colonia', 'sindicatura')),
  latitud  numeric(9, 6),
  longitud numeric(9, 6),
  unique (nombre, tipo)
);

-- ---------------------------------------------------------------------
-- empleado: cuentas del personal de SEMUJERES.
-- El id es el MISMO que el de auth.users (Supabase Auth guarda correo y
-- contraseña; aquí solo va el rol). Las políticas por rol usan auth.uid().
-- ---------------------------------------------------------------------
create table empleado (
  id             uuid primary key references auth.users (id) on delete restrict,
  nombre         text not null,
  rol            text not null
                 check (rol in ('titular', 'subdireccion', 'trabajo_social', 'psicologia', 'juridico')),
  area_id        smallint references cat_area (id) on delete restrict,  -- vacío para titular y subdirección
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create trigger empleado_actualizado
  before update on empleado
  for each row execute function set_actualizado_en();

-- ---------------------------------------------------------------------
-- persona: la persona atendida; el expediente único cuelga de aquí.
-- Se llama persona y no usuaria porque también se atiende a hombres.
-- fecha_nacimiento, sexo y entidad_nacimiento salen de la CURP; la edad
-- NO se guarda, se calcula.
-- ---------------------------------------------------------------------
create table persona (
  id                 uuid primary key default gen_random_uuid(),
  curp               text not null unique
                     check (length(curp) = 18 and curp = upper(curp)),
  nombres            text not null,
  apellido_paterno   text not null,
  apellido_materno   text,
  sexo               text check (sexo in ('H', 'M')),
  fecha_nacimiento   date,
  entidad_nacimiento text,
  estado_civil       text,
  celular            text,
  ocupacion          text,
  ingreso_mensual    numeric(10, 2),
  escolaridad        text,
  discapacidad       text,
  religion           text,
  grupo_etnico       text,
  servicio_medico    text,
  tiene_embarazo     boolean,
  numero_hijos       smallint check (numero_hijos >= 0),
  activo             boolean not null default true,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),
  creado_por         uuid references empleado (id) on delete restrict
);

create trigger persona_actualizado
  before update on persona
  for each row execute function set_actualizado_en();

-- ---------------------------------------------------------------------
-- domicilio: dónde vive y su vivienda. Una persona puede tener varios
-- (historial). El mapa suma por colonia_id.
-- ---------------------------------------------------------------------
create table domicilio (
  id             uuid primary key default gen_random_uuid(),
  persona_id     uuid not null references persona (id) on delete restrict,
  colonia_id     smallint references colonia (id) on delete restrict,
  direccion      text,
  codigo_postal  text,
  zona           text check (zona in ('urbana', 'rural')),
  tipo_vivienda  text,
  material       text,
  servicios      text,
  bienes         text,
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por     uuid references empleado (id) on delete restrict
);

create trigger domicilio_actualizado
  before update on domicilio
  for each row execute function set_actualizado_en();

-- Seguridad por fila (RLS): se activa y se define en 04_politicas.sql (Ángel).