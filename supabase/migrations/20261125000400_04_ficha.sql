-- =====================================================================
-- 04_ficha.sql
-- Qué contiene: lo que cuelga de la Ficha Única: estudio socioeconómico,
-- persona agresora, órdenes de protección, notas privadas por área,
-- derivaciones (canalizaciones) y documentos adjuntos (INE, foto...,
-- más el bucket privado 'documentos' de Storage).
-- Responsable: Sara (archivo iniciado por su compañera)
-- También: tiene_orden_vigente(), el trigger que pone la prioridad de las
-- alertas y los triggers de bitácora de estas tablas.
-- Depende de: 01_base.sql (empleado, cat_area, persona),
-- 02_atencion.sql (ficha_registro, cat_ocupacion, pre_registro, alerta) y
-- 03_complemento.sql (registrar_cambio), así que se corre después del 03.
-- Reglas de nombres y tipos: ver el encabezado de 01_base.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- cat_parentesco: parentesco de aportantes del hogar y de la persona
-- agresora con la persona atendida (Ficha Única).
-- ---------------------------------------------------------------------
create table cat_parentesco (
  id     smallint generated always as identity primary key,
  clave  text not null unique check (char_length(btrim(clave)) between 1 and 50),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 120)
);

alter table cat_parentesco enable row level security;

insert into cat_parentesco (clave, nombre) values
  ('esposo',        'Esposo / Cónyuge'),
  ('pareja',        'Pareja / Concubino(a)'),
  ('expareja',      'Expareja'),
  ('padre',         'Padre'),
  ('madre',         'Madre'),
  ('hermano',       'Hermano(a)'),
  ('hijo',          'Hijo(a)'),
  ('otro_familiar', 'Otro familiar'),
  ('conocido',      'Conocido(a)'),
  ('desconocido',   'Desconocido(a)'),
  ('otro',          'Otro');

-- ---------------------------------------------------------------------
-- estudio_socioeconomico: sección ESTUDIO SOCIOECONÓMICO de la Ficha
-- Única. Conserva historial por ficha mediante es_actual y fecha_estudio
-- (un estudio actual activo por ficha vía índice único parcial).
-- Los otros aportantes del hogar viven en la tabla hija aportante_hogar.
-- ---------------------------------------------------------------------
create table estudio_socioeconomico (
  id                     uuid primary key default gen_random_uuid(),
  ficha_id               uuid not null references ficha_registro (id) on delete restrict,
  fecha_estudio          date not null default current_date,
  es_actual              boolean not null default true,

  -- de la usuaria ("Ingreso mensual" en Datos generales)
  ingreso_mensual_propio numeric(10, 2) check (ingreso_mensual_propio between 0 and 9999999.99),

  -- del hogar
  numero_dependientes    smallint check (numero_dependientes between 0 and 30),
  tiene_apoyo            boolean not null default false, -- ¿cuenta con apoyo o beca?
  especificacion_apoyo   text check (char_length(especificacion_apoyo) <= 250),

  -- Vivienda y equipamiento del hogar (evaluación de Trabajo Social)
  tipo_vivienda          public.tipo_vivienda,
  material               public.material_vivienda,
  material_otro          text check (char_length(material_otro) <= 120),
  servicios              text[]
                         check (servicios <@ array['agua', 'drenaje', 'luz', 'pavimento',
                                                   'cable', 'internet']::text[]),
  bienes                 text[]
                         check (bienes <@ array['estufa', 'refrigerador', 'lavadora',
                                                'aire_acondicionado', 'abanico', 'tv',
                                                'microondas', 'computadora']::text[]),

  activo                 boolean not null default true,
  creado_en              timestamptz not null default now(),
  actualizado_en         timestamptz not null default now(),
  creado_por             uuid references empleado (id) on delete restrict,
  check (tiene_apoyo or especificacion_apoyo is null),
  check (coalesce(material = 'otro', false) or material_otro is null)
);

alter table estudio_socioeconomico enable row level security;

create trigger estudio_socioeconomico_actualizado
  before update on estudio_socioeconomico
  for each row execute function set_actualizado_en();

-- ---------------------------------------------------------------------
-- aportante_hogar: personas distintas a la usuaria que aportan ingresos
-- al hogar en un estudio socioeconómico (0, 1 o varias).
-- ---------------------------------------------------------------------
create table aportante_hogar (
  id                        uuid primary key default gen_random_uuid(),
  estudio_socioeconomico_id uuid not null references estudio_socioeconomico (id) on delete restrict,
  nombre                    text not null check (char_length(btrim(nombre)) between 1 and 150),
  parentesco_id             smallint references cat_parentesco (id) on delete restrict,
  parentesco_otro           text check (char_length(parentesco_otro) <= 120),
  ocupacion_id              smallint references cat_ocupacion (id) on delete restrict,
  ocupacion_otra            text check (char_length(ocupacion_otra) <= 150),
  tipo_trabajo              public.tipo_trabajo,
  monto                     numeric(10, 2) check (monto between 0 and 9999999.99),
  frecuencia                public.frecuencia_ingreso,
  activo                    boolean not null default true,
  creado_en                 timestamptz not null default now(),
  actualizado_en            timestamptz not null default now(),
  creado_por                uuid references empleado (id) on delete restrict
);

alter table aportante_hogar enable row level security;

create trigger aportante_hogar_actualizado
  before update on aportante_hogar
  for each row execute function set_actualizado_en();

-- ---------------------------------------------------------------------
-- agresor: persona agresora ligada a una ficha.
-- Una ficha puede tener uno o varios. Dato muy sensible de terceros.
-- A diferencia de persona, aquí la CURP es opcional (muchas veces no se
-- sabe), así que fecha de nacimiento y sexo se capturan a mano y NO se
-- calculan de la CURP.
-- ---------------------------------------------------------------------
create table agresor (
  id                    uuid primary key default gen_random_uuid(),
  ficha_id              uuid not null references ficha_registro (id) on delete restrict,

  nombres               text not null check (char_length(btrim(nombres)) between 1 and 100),
  apellido_paterno      text check (char_length(apellido_paterno) <= 100),
  apellido_materno      text check (char_length(apellido_materno) <= 100),
  edad                  smallint check (edad between 0 and 120),  -- si no saben la fecha de nacimiento
  fecha_nacimiento      date check (fecha_nacimiento <= current_date),
  entidad_nacimiento    text
                        check (entidad_nacimiento in ('AS','BC','BS','CC','CL','CM','CS','CH','DF','DG',
                                                      'GT','GR','HG','JC','MC','MN','MS','NT','NL','OC',
                                                      'PL','QT','QR','SP','SL','SR','TC','TS','TL','VZ',
                                                      'YN','ZS','NE')),
  sexo                  public.sexo_biologico,
  estado_civil          public.estado_civil,
  -- opcional y NO única (el mismo agresor puede estar en dos fichas);
  -- si se captura, se valida con el mismo formato que en persona
  curp                  text
                        check (curp ~ '^[A-Z][AEIOUX][A-Z]{2}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[HM](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z][0-9]$'),
  parentesco_id         smallint references cat_parentesco (id) on delete restrict,
  parentesco_otro       text check (char_length(parentesco_otro) <= 120),

  -- Domicilio: catálogo SEPOMEX opcional + domicilio estructurado (no usa la tabla
  -- domicilio, que es exclusiva de personas atendidas)
  asentamiento_id       integer references cat_asentamiento (id) on delete restrict,
  -- Fallback cuando asentamiento_id es null (p. ej. domicilio fuera de catálogo)
  codigo_postal         text check (codigo_postal ~ '^[0-9]{5}$'),
  calle                 text check (char_length(calle) <= 150),
  numero_exterior       text check (char_length(numero_exterior) <= 30),
  numero_interior       text check (char_length(numero_interior) <= 30),
  referencias           text check (char_length(referencias) <= 250),
  zona                  public.zona_geografica,

  -- Ocupación: Fijo / Temporal / Negocio propio
  ocupacion_id          smallint references cat_ocupacion (id) on delete restrict,
  ocupacion_otra        text check (char_length(ocupacion_otra) <= 150),
  tipo_trabajo          public.tipo_trabajo,

  -- Consumos y arma: sin valor por defecto; vacío = no se sabe
  tiene_consumo_droga   boolean,
  drogas                text[]
                        check (drogas <@ array['marihuana', 'cristal', 'cocaina',
                                               'inhalantes', 'medicamento_controlado', 'otra']::text[]),
  especificacion_droga  text check (char_length(especificacion_droga) <= 250),
  tiene_consumo_alcohol boolean,
  utilizo_arma_u_objeto boolean,  -- en el momento de la agresión
  tipo_arma             public.tipo_arma,
  especificacion_arma   text check (char_length(especificacion_arma) <= 250),
  observaciones         text check (char_length(observaciones) <= 5000),

  activo                boolean not null default true,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),
  creado_por            uuid references empleado (id) on delete restrict,
  unique (id, ficha_id),
  check (asentamiento_id is null or codigo_postal is null),
  check (coalesce(tiene_consumo_droga, false) or (drogas is null and especificacion_droga is null)),
  check (coalesce(utilizo_arma_u_objeto, false) or (tipo_arma is null and especificacion_arma is null))
);

alter table agresor enable row level security;

create trigger agresor_actualizado
  before update on agresor
  for each row execute function set_actualizado_en();

-- ---------------------------------------------------------------------
-- orden_proteccion (RF-17): seguimiento administrativo de las órdenes.
-- agresor_id: contra quién es (opcional; debe ser un agresor de la misma
-- ficha).
-- Una orden está VIGENTE si estado = 'vigente', activo y fecha_vigencia
-- no ha pasado (o está vacía). No basta con mirar estado: una orden con
-- fecha vencida sigue diciendo 'vigente' hasta que alguien la cambie.
-- Para preguntarlo se usa tiene_orden_vigente(persona_id), abajo.
-- ---------------------------------------------------------------------
create table orden_proteccion (
  id                uuid primary key default gen_random_uuid(),
  ficha_id          uuid not null references ficha_registro (id) on delete restrict,
  agresor_id        uuid,
  numero_oficio     text check (char_length(numero_oficio) <= 80),
  autoridad_emisora text check (char_length(autoridad_emisora) <= 150),
  fecha_emision     date not null,
  fecha_vigencia    date,
  estado            public.estado_orden_proteccion not null default 'vigente',
  activo            boolean not null default true,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  creado_por        uuid references empleado (id) on delete restrict,
  unique (id, ficha_id),
  check (fecha_vigencia is null or fecha_vigencia >= fecha_emision),
  foreign key (agresor_id, ficha_id) references agresor (id, ficha_id) on delete restrict
);

alter table orden_proteccion enable row level security;

create trigger orden_proteccion_actualizado
  before update on orden_proteccion
  for each row execute function set_actualizado_en();

-- ---------------------------------------------------------------------
-- tiene_orden_vigente(): ¿esta persona tiene hoy una orden de protección
-- vigente? La usan el trigger de alerta y la web.
-- Es security definer para que el trigger funcione aunque la alerta la
-- mande la usuaria desde la app (ella no puede leer orden_proteccion),
-- pero NO se abre como RPC: si cualquiera pudiera llamarla, podría
-- averiguar quién tiene orden. El personal la consulta en la tabla.
-- ---------------------------------------------------------------------
create or replace function tiene_orden_vigente(p_persona_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from orden_proteccion o
    join ficha_registro f on f.id = o.ficha_id
    where f.persona_id = p_persona_id
      and o.activo
      and o.estado = 'vigente'
      and (o.fecha_vigencia is null or o.fecha_vigencia >= current_date)
  );
$$;

revoke execute on function tiene_orden_vigente(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- alerta_prioridad (RF-20, RN-17): al crear una alerta,
--   - si viene de la app, entra como 'media' (aunque la app mande otra);
--   - si la persona tiene orden de protección vigente, sube a 'alta'.
-- La persona se busca por persona_id o, si la mandó desde la app, por
-- la liga de su pre_registro.
-- La tabla alerta está en 02; el trigger va aquí porque necesita
-- orden_proteccion.
-- ---------------------------------------------------------------------
create or replace function asignar_prioridad_alerta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_persona_id uuid;
begin
  if new.origen = 'app_movil' then
    new.prioridad = 'media';
  end if;

  v_persona_id = coalesce(
    new.persona_id,
    (select r.persona_id from pre_registro r where r.id = new.pre_registro_id)
  );

  if v_persona_id is not null and tiene_orden_vigente(v_persona_id) then
    new.prioridad = 'alta';
  end if;
  return new;
end;
$$;

create trigger alerta_prioridad
  before insert on alerta
  for each row execute function asignar_prioridad_alerta();


---NOTA_AREA----------------------
-- Son notas privadas de cada área, no se comparten con otras áreas ni con la persona atendida.
create table nota_area (
  id               uuid primary key default gen_random_uuid(),
  ficha_id         uuid not null references ficha_registro (id) on delete restrict,
  area_id          smallint not null references cat_area (id) on delete restrict,
  contenido        text not null check (char_length(btrim(contenido)) between 1 and 5000),
  activo           boolean not null default true,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  creado_por       uuid references empleado (id) on delete restrict
);

alter table nota_area enable row level security;

create trigger nota_area_actualizado
  before update on nota_area
  for each row execute function set_actualizado_en();

-- ---------------------------------------------------------------------
-- derivacion (RF-08): a dónde se canaliza a la persona.
-- Destinos internos: las tres áreas. Externos: fiscalía, refugio,
-- capacitación u otra institución (RN-03: a un hombre que no es tema
-- jurídico se le canaliza a otra institución; RN-11: fiscalía y refugio
-- según el protocolo).
-- institucion_otra: respaldo de texto cuando la institución externa no
-- está en directorio_institucion (obligatorio si destino = 'otra_institucion'
-- e institucion_id es nulo). Para refugio NUNCA se escribe la dirección,
-- solo el nombre.
-- area_origen_id: desde qué área se deriva (sirve para "primera vez"
-- por área, RN-19, y para la línea de tiempo del caso, RF-25).
-- ---------------------------------------------------------------------
create table derivacion (
  id                  uuid primary key default gen_random_uuid(),
  ficha_id            uuid not null references ficha_registro (id) on delete restrict,
  area_origen_id      smallint references cat_area (id) on delete restrict,
  area_destino_id     smallint references cat_area (id) on delete restrict,
  institucion_id      smallint references directorio_institucion (id) on delete restrict,
  destino             public.destino_derivacion not null,
  institucion_otra    text check (char_length(institucion_otra) <= 200),
  motivo              text check (char_length(motivo) <= 1000),
  fecha_derivacion    date not null default current_date,
  estado              public.estado_derivacion not null default 'pendiente',
  activo              boolean not null default true,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),
  creado_por          uuid references empleado (id) on delete restrict,
  check ((destino in ('trabajo_social', 'psicologia', 'juridico')) = (area_destino_id is not null)),
  check (area_destino_id is null or (institucion_id is null and institucion_otra is null)),
  check (institucion_id is null or institucion_otra is null),
  check (destino <> 'otra_institucion' or institucion_id is not null or btrim(coalesce(institucion_otra, '')) <> '')
);

alter table derivacion enable row level security;

create trigger derivacion_actualizado
  before update on derivacion
  for each row execute function set_actualizado_en();

create or replace function validar_derivacion_area()
returns trigger
language plpgsql
as $$
declare
  v_clave text;
begin
  if new.destino in ('trabajo_social', 'psicologia', 'juridico') then
    select a.clave into v_clave
    from cat_area a
    where a.id = new.area_destino_id;

    if v_clave is distinct from new.destino::text then
      raise exception 'area_destino_id (%) no corresponde al destino %', new.area_destino_id, new.destino;
    end if;
  end if;
  return new;
end;
$$;

create trigger derivacion_validar_area
  before insert or update on derivacion
  for each row execute function validar_derivacion_area();

-- ---------------------------------------------------------------------
-- cat_tipo_documento: qué clase de archivo se adjunta al expediente.
-- Es catálogo porque la lista crece. INE y foto los pide RF-35; los
-- demás son PROVISIONALES (propuestos por el equipo, confirmar con
-- SEMUJERES).
-- ---------------------------------------------------------------------
create table cat_tipo_documento (
  id     smallint generated always as identity primary key,
  clave  text not null unique check (char_length(btrim(clave)) between 1 and 50),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 120)
);

alter table cat_tipo_documento enable row level security;

insert into cat_tipo_documento (clave, nombre) values
  ('ine',                   'Copia de la INE'),
  ('foto',                  'Fotografía'),
  ('comprobante_domicilio', 'Comprobante de domicilio'),
  ('acta_nacimiento',       'Acta de nacimiento'),
  ('curp',                  'Constancia de CURP'),
  ('denuncia',              'Copia de la denuncia'),
  ('orden_proteccion',      'Copia de la orden de protección'),
  ('solicitud',             'Hoja de solicitud'),
  ('otro',                  'Otro');

-- ---------------------------------------------------------------------
-- documento (RF-35): archivos adjuntos al expediente de la persona (INE,
-- foto y los demás de cat_tipo_documento).
-- El archivo NO se guarda en la tabla: vive en Storage, en el bucket
-- privado 'documentos'; aquí solo va su ruta (ruta_storage) y sus datos.
-- Para verlo, la web pide una URL firmada temporal. Quién puede subir o
-- ver archivos lo definen las políticas de storage.objects (las escribe
-- quien hace las políticas).
-- descripcion: obligatoria si el tipo es 'otro' (lo valida la web).
-- ---------------------------------------------------------------------
create table documento (
  id                  uuid primary key default gen_random_uuid(),
  ficha_id            uuid not null references ficha_registro (id) on delete restrict,
  tipo_documento_id   smallint not null references cat_tipo_documento (id) on delete restrict,
  orden_proteccion_id uuid,
  descripcion         text check (char_length(descripcion) <= 500),
  ruta_storage        text not null unique check (char_length(btrim(ruta_storage)) between 1 and 500),  -- p. ej. '<ficha_id>/<archivo>.pdf'
  nombre_archivo      text not null check (char_length(btrim(nombre_archivo)) between 1 and 255),         -- nombre original del archivo
  activo              boolean not null default true,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),
  creado_por          uuid references empleado (id) on delete restrict,
  foreign key (orden_proteccion_id, ficha_id) references orden_proteccion (id, ficha_id) on delete restrict
);

alter table documento enable row level security;

create trigger documento_actualizado
  before update on documento
  for each row execute function set_actualizado_en();

-- Bucket privado de Storage para los archivos (máximo 10 MB; solo
-- imágenes JPG/PNG y PDF).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 10485760,
        array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do nothing;

-- Bitácora automática de cambios en las tablas de este archivo
-- (registrar_cambio() está en 03_complemento.sql).
create trigger estudio_socioeconomico_bitacora after insert or update on estudio_socioeconomico for each row execute function registrar_cambio();
create trigger aportante_hogar_bitacora        after insert or update on aportante_hogar        for each row execute function registrar_cambio();
create trigger agresor_bitacora                after insert or update on agresor                for each row execute function registrar_cambio();
create trigger orden_proteccion_bitacora       after insert or update on orden_proteccion       for each row execute function registrar_cambio();
create trigger nota_area_bitacora              after insert or update on nota_area              for each row execute function registrar_cambio();
create trigger derivacion_bitacora             after insert or update on derivacion             for each row execute function registrar_cambio();
create trigger documento_bitacora              after insert or update on documento              for each row execute function registrar_cambio();

-- ---------------------------------------------------------------------
-- Índices.
-- ---------------------------------------------------------------------
create index estudio_socioeconomico_ficha_id_idx on estudio_socioeconomico (ficha_id);
create unique index estudio_socioeconomico_ficha_actual_uidx on estudio_socioeconomico (ficha_id) where activo and es_actual;
create index aportante_hogar_estudio_id_idx on aportante_hogar (estudio_socioeconomico_id);
create index agresor_ficha_id_idx          on agresor (ficha_id);
create index agresor_asentamiento_id_idx   on agresor (asentamiento_id);
create index agresor_nombres_trgm_idx      on agresor using gin (nombres extensions.gin_trgm_ops);
create index agresor_apellido_paterno_trgm_idx on agresor using gin (apellido_paterno extensions.gin_trgm_ops);
create index orden_proteccion_ficha_id_idx on orden_proteccion (ficha_id);
create index nota_area_ficha_area_idx      on nota_area (ficha_id, area_id);
create index derivacion_ficha_id_idx       on derivacion (ficha_id);
create index derivacion_institucion_id_idx on derivacion (institucion_id);
create index documento_ficha_id_idx            on documento (ficha_id);
create index documento_orden_proteccion_id_idx on documento (orden_proteccion_id);
