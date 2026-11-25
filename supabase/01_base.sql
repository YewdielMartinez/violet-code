-- =====================================================================
-- 01_base.sql
-- Qué contiene: áreas, colonias, empleados, usuarios externos (UMECA),
-- personas atendidas y domicilios.
-- Es la base de la que cuelgan las demás tablas (ficha, atención, cita,
-- alerta...).
-- Responsable: Sara
--
-- REGLAS DEL EQUIPO
-- Sirven para que todos escribamos igual y las tablas se puedan unir
-- sin sorpresas.
--
-- 1. NOMBRES
--    Todo en minúsculas y con guion bajo (snake_case), en español, sin
--    acentos ni eñ. Ejemplos: fecha_nacimiento, apellido_paterno, anio.
--    Las tablas van en singular: persona, cita, alerta (no "personas").
--    Los catálogos empiezan con cat_: cat_area.
--
-- 2. LLAVE PRIMARIA (lo que identifica cada fila)
--    Siempre se llama id.
--    Tablas normales:    id uuid default gen_random_uuid()  (se genera sola)
--    Catálogos chicos:   id smallint generated always as identity (1, 2, 3...)
--
-- 3. LLAVE FORÁNEA (la columna que apunta a otra tabla)
--    Se llama <tabla a la que apunta>_id: persona_id, ficha_id.
--    Si apunta a un catálogo, se quita el cat_: cat_area -> area_id,
--    cat_colonia -> colonia_id.
--    Debe ser del MISMO tipo que el id al que apunta (uuid con uuid,
--    smallint con smallint); si no, Supabase marca error.
--    Si una tabla apunta dos veces a la misma, el nombre dice el papel:
--    creado_por, atendida_por (ambas apuntan a empleado).
--
-- 4. TIPOS DE DATOS
--    Texto: text (nunca varchar ni char(n)).   Fecha sola: date.
--    Fecha con hora: timestamptz.              Dinero: numeric(10, 2).
--    Sí/no: boolean.
--
-- 5. NOMBRE DEL CAMPO SEGÚN SU TIPO
--    Sí/no:          empieza con es_ o tiene_   (es_victima_delito, tiene_embarazo)
--    Fecha sola:     empieza con fecha_         (fecha_nacimiento)
--    Fecha con hora: termina en _en             (creado_en, confirmada_en)
--
-- 6. CAMPOS QUE LLEVAN LAS TABLAS DE DATOS
--    activo          boolean not null default true (false = dado de baja)
--    creado_en       cuándo se registró (se llena sola)
--    actualizado_en  última modificación (se llena sola con el trigger
--                    set_actualizado_en(); en cada tabla nueva se agrega
--                    su "create trigger")
--    creado_por      qué empleado lo registró (apunta a empleado)
--    Excepciones: los catálogos (cat_) no llevan estos campos;
--    pre_registro no lleva creado_por (lo crea la usuaria desde la app);
--    bitacora_acceso solo se escribe, no lleva actualizado_en ni trigger.
--
-- 7. NO SE BORRA NADA
--    Las llaves foráneas llevan on delete restrict: la base no deja borrar
--    una persona que ya tiene citas. Para dar de baja se pone activo = false.
--
-- 8. SEGURIDAD
--    Justo después de cada create table va:
--      alter table <tabla> enable row level security;
--    Las políticas (quién puede ver o cambiar qué) se escriben en otro
--    archivo y las hace otra persona; aquí no se escriben.
--
-- 9. OPCIONES FIJAS
--    Si la lista no cambia: text con check (campo in (...)).
--    Si la lista puede crecer: catálogo cat_.
--
-- ORDEN DE CARGA
--    01_base -> 02_atencion -> 03_complemento -> 04_ficha -> vistas -> seed
--    (03 y 04 dependen de ficha_registro, que está en 02).
--    Más adelante se renombran a supabase/migrations/<fecha>_nombre.sql.
--    Una vez aplicada una migración, ya no se edita: los cambios van en
--    una migración nueva con alter table.
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

alter table cat_area enable row level security;

insert into cat_area (clave, nombre) values
  ('trabajo_social', 'Trabajo Social'),
  ('psicologia',     'Psicología'),
  ('juridico',       'Jurídico');

-- ---------------------------------------------------------------------
-- cat_colonia: catálogo de colonias y sindicaturas (domicilio, alertas,
-- actividades preventivas y, a futuro, el mapa de calor).
-- ---------------------------------------------------------------------
create table cat_colonia (
  id       smallint generated always as identity primary key,
  nombre   text not null,
  tipo     text not null default 'colonia' check (tipo in ('colonia', 'sindicatura')),
  latitud  numeric(9, 6),
  longitud numeric(9, 6),
  unique (nombre, tipo)
);

alter table cat_colonia enable row level security;

-- ---------------------------------------------------------------------
-- empleado: cuentas del personal de SEMUJERES.
-- El id es el MISMO que el de auth.users (Supabase Auth guarda correo y
-- contraseña; aquí solo va el rol). Las políticas por rol usan auth.uid().
-- rol dice qué puede hacer; area_id dice a qué área pertenece. Solo
-- trabajo social, psicología y jurídico tienen área; titular,
-- subdirección y recepción no (recepción solo maneja la agenda).
-- ---------------------------------------------------------------------
create table empleado (
  id             uuid primary key references auth.users (id) on delete restrict,
  nombre         text not null,
  rol            text not null
                 check (rol in ('titular', 'subdireccion', 'trabajo_social',
                                'psicologia', 'juridico', 'recepcion')),
  area_id        smallint references cat_area (id) on delete restrict,
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por     uuid references empleado (id) on delete restrict,  -- vacío para la primera cuenta
  check ((rol in ('trabajo_social', 'psicologia', 'juridico')) = (area_id is not null))
);

alter table empleado enable row level security;

create trigger empleado_actualizado
  before update on empleado
  for each row execute function set_actualizado_en();

-- ---------------------------------------------------------------------
-- usuario_externo: cuentas de consulta de otras dependencias (hoy solo
-- UMECA). No es personal de SEMUJERES. Solo puede leer vistas de solo
-- lectura (nombre de la usuaria canalizada, fecha y estado de sus citas
-- con origen = 'umeca'); nada de expediente, notas ni CURP. Sus
-- consultas quedan en la bitácora.
-- El id es el MISMO que el de auth.users, igual que en empleado.
-- ---------------------------------------------------------------------
create table usuario_externo (
  id             uuid primary key references auth.users (id) on delete restrict,
  nombre         text not null,
  dependencia    text not null default 'umeca'
                 check (dependencia in ('umeca')),
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por     uuid references empleado (id) on delete restrict
);

alter table usuario_externo enable row level security;

create trigger usuario_externo_actualizado
  before update on usuario_externo
  for each row execute function set_actualizado_en();

-- ---------------------------------------------------------------------
-- persona: la persona atendida; el expediente único cuelga de aquí.
-- Se llama persona y no usuaria porque también se atiende a hombres.
-- sexo, fecha_nacimiento y entidad_nacimiento se calculan SOLOS a partir
-- de la CURP (columnas generadas): no se capturan ni se mandan al
-- insertar, solo se lee. La edad NO se guarda, se calcula.
-- El check de curp valida el formato oficial (18 caracteres, fecha
-- válida, H o M, clave de entidad); las CURP de los datos de ejemplo
-- deben cumplirlo.
-- ---------------------------------------------------------------------
create table persona (
  id                 uuid primary key default gen_random_uuid(),
  curp               text not null unique
                     check (curp ~ '^[A-Z][AEIOUX][A-Z]{2}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[HM](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z][0-9]$'),
  nombres            text not null,
  apellido_paterno   text not null,
  apellido_materno   text,
  -- posición 11 de la CURP: H o M
  sexo               text not null
                     generated always as (substr(curp, 11, 1)) stored,
  -- posiciones 5 a 10 (AAMMDD); la posición 17 dice el siglo:
  -- número = 1900, letra = 2000
  fecha_nacimiento   date not null
                     generated always as (make_date(
                       (case when substr(curp, 17, 1) ~ '[0-9]' then 1900 else 2000 end)
                         + substr(curp, 5, 2)::int,
                       substr(curp, 7, 2)::int,
                       substr(curp, 9, 2)::int)) stored,
  -- posiciones 12 y 13: clave de la entidad (SL = Sinaloa, NE = nació
  -- en el extranjero)
  entidad_nacimiento text not null
                     generated always as (substr(curp, 12, 2)) stored,
  celular            text,
  -- último grado concluido, con las casillas de la Ficha Única
  escolaridad        text
                     check (escolaridad in ('ninguna', 'primaria', 'secundaria',
                                            'preparatoria', 'carrera', 'otros_estudios')),
  discapacidad       text,
  religion           text,
  grupo_etnico       text,
  activo             boolean not null default true,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),
  creado_por         uuid references empleado (id) on delete restrict
);

alter table persona enable row level security;

create trigger persona_actualizado
  before update on persona
  for each row execute function set_actualizado_en();

-- ---------------------------------------------------------------------
-- domicilio: dónde vive y su vivienda. Una persona puede tener varios
-- (historial). El mapa suma por colonia_id.
-- La parte de vivienda sigue la sección "TIPO DE VIVIENDA" de la Ficha
-- Única. servicios y bienes son listas porque se marcan varias casillas:
-- vacío (null) = no se contestó; lista vacía ('{}') = no cuenta con
-- ninguno.
-- ---------------------------------------------------------------------
create table domicilio (
  id             uuid primary key default gen_random_uuid(),
  persona_id     uuid not null references persona (id) on delete restrict,
  colonia_id     smallint references cat_colonia (id) on delete restrict,
  direccion      text,
  codigo_postal  text,
  zona           text check (zona in ('urbana', 'rural')),
  -- ¿Su vivienda es?
  tipo_vivienda  text
                 check (tipo_vivienda in ('propia', 'hipotecada', 'rentada',
                                          'invasion', 'infonavit', 'prestada')),
  -- Material de construcción (si es 'otro', se escribe en material_otro)
  material       text
                 check (material in ('ladrillo', 'lamina', 'block', 'madera',
                                     'carton', 'otro')),
  material_otro  text,
  -- ¿Con qué servicios cuenta?
  servicios      text[]
                 check (servicios <@ array['agua', 'drenaje', 'luz', 'pavimento',
                                           'cable', 'internet']::text[]),
  -- Su vivienda cuenta con
  bienes         text[]
                 check (bienes <@ array['estufa', 'refrigerador', 'lavadora',
                                        'aire_acondicionado', 'abanico', 'tv',
                                        'microondas', 'computadora']::text[]),
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por     uuid references empleado (id) on delete restrict
);

alter table domicilio enable row level security;

create trigger domicilio_actualizado
  before update on domicilio
  for each row execute function set_actualizado_en();

-- ---------------------------------------------------------------------
-- Índices: para que las búsquedas no revisen la tabla completa.
-- (curp y folio ya tienen índice por ser unique.)
-- Búsqueda por nombre (RF-03): pg_trgm permite buscar un pedazo del
-- nombre ('%garc%') rápido y sin importar mayúsculas.
-- ---------------------------------------------------------------------
create extension if not exists pg_trgm with schema extensions;

create index persona_nombres_trgm_idx          on persona using gin (nombres extensions.gin_trgm_ops);
create index persona_apellido_paterno_trgm_idx on persona using gin (apellido_paterno extensions.gin_trgm_ops);
create index persona_apellido_materno_trgm_idx on persona using gin (apellido_materno extensions.gin_trgm_ops);
create index domicilio_persona_id_idx          on domicilio (persona_id);
