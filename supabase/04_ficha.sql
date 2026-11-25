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
-- estudio_socioeconomico: sección ESTUDIO SOCIOECONÓMICO de la Ficha
-- Única (una por ficha). OJO, en el formulario hay datos de dos personas:
--   - de la usuaria: su ingreso mensual (viene de "Datos generales"; su
--     ocupación y si trabaja están en ficha_registro).
--   - de quien MÁS aporta al hogar ("¿Quién?"): su ocupación, tipo de
--     trabajo y cuánto aporta. Por eso esas columnas terminan en
--     _aportante.
-- Personas que dependen del ingreso y apoyo o beca son del hogar.
-- ---------------------------------------------------------------------
create table estudio_socioeconomico (
  id                     uuid primary key default gen_random_uuid(),
  ficha_id               uuid not null unique references ficha_registro (id) on delete restrict,

  -- de la usuaria ("Ingreso mensual" en Datos generales)
  ingreso_mensual_propio numeric(10, 2) check (ingreso_mensual_propio >= 0),

  -- ¿Alguien más aporta ingresos a su hogar? ¿Quién?
  tiene_otro_aportante   boolean not null default false,
  nombre_aportante       text,
  -- Ocupación de la persona: Fijo / Temporal / Negocio propio
  ocupacion_aportante    text,
  tipo_trabajo_aportante text
                         check (tipo_trabajo_aportante in ('fijo', 'temporal', 'negocio_propio')),
  -- ¿Cuánto es el ingreso que aporta? y frecuencia
  monto_aportante        numeric(10, 2) check (monto_aportante >= 0),
  frecuencia_aportante   text
                         check (frecuencia_aportante in ('diario', 'semanal', 'quincenal',
                                                         'mensual', 'variable')),

  -- del hogar
  numero_dependientes    smallint check (numero_dependientes >= 0),
  tiene_apoyo            boolean not null default false, -- ¿cuenta con apoyo o beca?
  especificacion_apoyo   text,

  activo                 boolean not null default true,
  creado_en              timestamptz not null default now(),
  actualizado_en         timestamptz not null default now(),
  creado_por             uuid references empleado (id) on delete restrict
);

alter table estudio_socioeconomico enable row level security;

create trigger estudio_socioeconomico_actualizado
  before update on estudio_socioeconomico
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

  nombre                text not null,
  edad                  smallint check (edad between 0 and 120),  -- si no saben la fecha de nacimiento
  fecha_nacimiento      date,
  lugar_nacimiento      text,
  sexo                  text check (sexo in ('H', 'M')),
  estado_civil          text
                        check (estado_civil in ('soltero', 'casado', 'union_libre',
                                                'separado', 'divorciado', 'viudo')),
  -- opcional y NO única (el mismo agresor puede estar en dos fichas);
  -- si se captura, se valida con el mismo formato que en persona
  curp                  text
                        check (curp ~ '^[A-Z][AEIOUX][A-Z]{2}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[HM](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z][0-9]$'),
  parentesco            text,  -- "Parentesco con el agresor"

  -- Domicilio: texto libre (no usa la tabla domicilio, que es solo de
  -- personas atendidas)
  direccion             text,
  zona                  text check (zona in ('urbana', 'rural')),

  -- Ocupación: Fijo / Temporal / Negocio propio
  ocupacion_id          smallint references cat_ocupacion (id) on delete restrict,
  ocupacion_otra        text,
  tipo_trabajo          text check (tipo_trabajo in ('fijo', 'temporal', 'negocio_propio')),

  -- Consumos y arma: sin valor por defecto; vacío = no se sabe
  tiene_consumo_droga   boolean,
  especificacion_droga  text,
  tiene_consumo_alcohol boolean,
  utilizo_arma_u_objeto boolean,  -- en el momento de la agresión
  especificacion_arma   text,
  observaciones         text,

  activo                boolean not null default true,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),
  creado_por            uuid references empleado (id) on delete restrict
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
  id               uuid primary key default gen_random_uuid(),
  ficha_id         uuid not null references ficha_registro (id) on delete restrict,
  agresor_id       uuid references agresor (id) on delete restrict,
  fecha_emision    date not null,
  fecha_vigencia   date,
  estado           text not null default 'vigente'
                   check (estado in ('vigente', 'vencida', 'cancelada', 'en_tramite')),
  activo           boolean not null default true,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  creado_por       uuid references empleado (id) on delete restrict
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
  contenido        text not null,
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
-- institucion_destino: nombre de la institución externa; obligatorio si
-- destino = 'otra_institucion'. Para refugio NUNCA se escribe la
-- dirección, solo el nombre.
-- area_origen_id: desde qué área se deriva (sirve para "primera vez"
-- por área, RN-19, y para la línea de tiempo del caso, RF-25).
-- ---------------------------------------------------------------------
create table derivacion (
  id                  uuid primary key default gen_random_uuid(),
  ficha_id            uuid not null references ficha_registro (id) on delete restrict,
  area_origen_id      smallint references cat_area (id) on delete restrict,
  destino             text not null
                      check (destino in (
                        'trabajo_social',
                        'psicologia',
                        'juridico',
                        'fiscalia',
                        'refugio',
                        'capacitacion',
                        'otra_institucion'
                      )),
  institucion_destino text,
  motivo              text,
  fecha_derivacion    date not null default current_date,
  estado              text not null default 'pendiente'
                      check (estado in (
                        'pendiente',
                        'en_proceso',
                        'concluida',
                        'cancelada'
                      )),
  activo              boolean not null default true,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),
  creado_por          uuid references empleado (id) on delete restrict,
  check (destino <> 'otra_institucion' or institucion_destino is not null)
);

alter table derivacion enable row level security;

create trigger derivacion_actualizado
  before update on derivacion
  for each row execute function set_actualizado_en();

-- ---------------------------------------------------------------------
-- cat_tipo_documento: qué clase de archivo se adjunta al expediente.
-- Es catálogo porque la lista crece. INE y foto los pide RF-35; los
-- demás son PROVISIONALES (propuestos por el equipo, confirmar con
-- SEMUJERES).
-- ---------------------------------------------------------------------
create table cat_tipo_documento (
  id     smallint generated always as identity primary key,
  clave  text not null unique,
  nombre text not null
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
  id                uuid primary key default gen_random_uuid(),
  persona_id        uuid not null references persona (id) on delete restrict,
  tipo_documento_id smallint not null references cat_tipo_documento (id) on delete restrict,
  descripcion       text,
  ruta_storage      text not null unique,  -- p. ej. '<persona_id>/<archivo>.pdf'
  nombre_archivo    text not null,         -- nombre original del archivo
  activo            boolean not null default true,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  creado_por        uuid references empleado (id) on delete restrict
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
create trigger agresor_bitacora                after insert or update on agresor                for each row execute function registrar_cambio();
create trigger orden_proteccion_bitacora       after insert or update on orden_proteccion       for each row execute function registrar_cambio();
create trigger nota_area_bitacora              after insert or update on nota_area              for each row execute function registrar_cambio();
create trigger derivacion_bitacora             after insert or update on derivacion             for each row execute function registrar_cambio();
create trigger documento_bitacora              after insert or update on documento              for each row execute function registrar_cambio();

-- ---------------------------------------------------------------------
-- Índices.
-- (estudio_socioeconomico.ficha_id ya tiene índice por ser unique.)
-- ---------------------------------------------------------------------
create index agresor_ficha_id_idx          on agresor (ficha_id);
create index orden_proteccion_ficha_id_idx on orden_proteccion (ficha_id);
create index nota_area_ficha_area_idx      on nota_area (ficha_id, area_id);
create index derivacion_ficha_id_idx       on derivacion (ficha_id);
create index documento_persona_id_idx      on documento (persona_id);
