-- =====================================================================
-- 02_atencion.sql
-- Qué contiene: catálogo de tipos de atención, la Ficha Única
-- (ficha_registro), el pre-registro de la app y su liga por CURP, la
-- agenda de citas, las atenciones (hoja de seguimiento de cada visita)
-- y las alertas del botón de ayuda.
-- Responsable: Sara
-- Depende de: 01_base.sql (persona, empleado, cat_area, cat_asentamiento,
-- domicilio).
-- cita va antes de atencion porque más adelante atencion le apuntará.
-- Las tablas de 03_complemento.sql y 04_ficha.sql apuntan a
-- ficha_registro, así que este archivo se corre ANTES que el 03.
-- Reglas de nombres y tipos: ver el encabezado de 01_base.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- cat_tipo_atencion: qué tipo de atención se dio, por área. Es el "tipo"
-- del informe mensual (tipo, cuántas personas, hombres y mujeres).
-- "Primera vez" y "seguimiento" NO son tipos: se calculan en las vistas.
-- area_id sirve para que la web solo muestre los tipos del área.
-- VALORES PROVISIONALES: SEMUJERES no ha dado su lista; hay que
-- confirmarlos con ellas y reemplazarlos.
-- ---------------------------------------------------------------------
create table cat_tipo_atencion (
  id      smallint generated always as identity primary key,
  area_id smallint not null references cat_area (id) on delete restrict,
  clave   text not null unique check (char_length(btrim(clave)) between 1 and 50),
  nombre  text not null check (char_length(btrim(nombre)) between 1 and 120),
  unique (id, area_id)
);

alter table cat_tipo_atencion enable row level security;

insert into cat_tipo_atencion (area_id, clave, nombre)
select a.id, v.clave, v.nombre
from (values
  ('trabajo_social', 'entrevista_inicial',          'Entrevista inicial'),
  ('trabajo_social', 'orientacion',                 'Orientación'),
  ('trabajo_social', 'canalizacion',                'Canalización'),
  ('trabajo_social', 'acompanamiento',              'Acompañamiento'),
  ('psicologia',     'valoracion_inicial',          'Valoración inicial'),
  ('psicologia',     'terapia_individual',          'Terapia individual'),
  ('psicologia',     'intervencion_crisis',         'Intervención en crisis'),
  ('juridico',       'asesoria_juridica',           'Asesoría jurídica'),
  ('juridico',       'acompanamiento_fiscalia',     'Acompañamiento a fiscalía'),
  ('juridico',       'tramite_orden_proteccion',    'Trámite de orden de protección')
) as v (area, clave, nombre)
join cat_area a on a.clave = v.area;

-- ---------------------------------------------------------------------
-- cat_ocupacion: ocupaciones. En el papel "Ocupación" es una línea libre;
-- con catálogo todos escriben igual y se puede contar. Si no está en la
-- lista, se elige 'otra' y se escribe en ocupacion_otra.
-- VALORES PROVISIONALES: propuestos por el equipo, no vienen del
-- formulario; hay que confirmarlos con SEMUJERES.
-- ---------------------------------------------------------------------
create table cat_ocupacion (
  id     smallint generated always as identity primary key,
  clave  text not null unique check (char_length(btrim(clave)) between 1 and 50),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 120)
);

alter table cat_ocupacion enable row level security;

insert into cat_ocupacion (clave, nombre) values
  ('hogar',       'Hogar'),
  ('empleada',    'Empleada(o)'),
  ('comerciante', 'Comerciante'),
  ('estudiante',  'Estudiante'),
  ('jornalera',   'Jornalera(o)'),
  ('desempleada', 'Desempleada(o)'),
  ('jubilada',    'Jubilada(o) o pensionada(o)'),
  ('otra',        'Otra');

-- ---------------------------------------------------------------------
-- ficha_registro: la Ficha Única de la persona; es su expediente.
-- UNA por persona (RN-02): si regresa, no se hace otra ficha, se llena
-- una atención (hoja de seguimiento); si estaba archivada, se reabre.
-- La crea Trabajo Social y la ven las tres áreas. El folio lo capturan
-- ellos (no se genera solo).
-- Los servicios solicitados ("Servicio solicitado") se guardan en la
-- tabla puente N:M ficha_servicio_solicitado (ligada a cat_area).
-- La prioridad del caso NO va aquí: va en cada atención (atencion).
-- aviso_privacidad_aceptado_en (RNF-04, consentimiento registrado): la
-- usuaria recibe el aviso en el papel; al transcribir, el personal marca
-- la casilla "La persona recibió y aceptó el aviso de privacidad" y se
-- guarda la fecha. Sin esa casilla no se crea la ficha.
-- ---------------------------------------------------------------------
create table ficha_registro (
  id                           uuid primary key default gen_random_uuid(),
  folio                        text not null unique check (char_length(btrim(folio)) between 1 and 50),
  persona_id                   uuid not null unique references persona (id) on delete restrict,
  registrada_en                timestamptz not null default now(),  -- "Fecha" y "Hora"
  estado                       public.estado_ficha not null default 'abierto',
  aviso_privacidad_aceptado_en timestamptz not null,
  es_victima_delito            boolean,
  -- Datos que cambian con el tiempo: van aquí (como estaban al
  -- registrarse) y no en persona; en cada visita se guarda una copia en
  -- atencion.
  estado_civil                 public.estado_civil,
  ocupacion_id                 smallint references cat_ocupacion (id) on delete restrict,
  ocupacion_otra               text check (char_length(ocupacion_otra) <= 150),      -- si ocupacion_id es 'otra'
  -- ¿Trabaja? (su ingreso mensual está en estudio_socioeconomico,
  -- columna ingreso_mensual_propio)
  tiene_trabajo                boolean,
  -- ¿Tiene algún servicio médico? 'ninguno' = NO; si es 'otro', se
  -- escribe cuál en servicio_medico_otro
  servicio_medico              public.servicio_medico,
  servicio_medico_otro         text check (char_length(servicio_medico_otro) <= 150),
  -- Núm. de hijos: el total es numero_hijas + numero_hijos_hombres
  numero_hijas                 smallint check (numero_hijas between 0 and 30),
  numero_hijos_hombres         smallint check (numero_hijos_hombres between 0 and 30),
  tiene_embarazo               boolean,
  tiene_denuncia               boolean,   -- si interpuso denuncia
  tiene_consumo_droga          boolean,
  drogas                       text[]
                               check (drogas <@ array['marihuana', 'cristal', 'cocaina',
                                                      'inhalantes', 'medicamento_controlado', 'otra']::text[]),
  especificacion_droga         text check (char_length(especificacion_droga) <= 250),      -- "Especifique" de droga
  tiene_consumo_alcohol        boolean,
  activo                       boolean not null default true,
  creado_en              timestamptz not null default now(),
  actualizado_en         timestamptz not null default now(),
  creado_por             uuid references empleado (id) on delete restrict,
  check (coalesce(tiene_consumo_droga, false) or (drogas is null and especificacion_droga is null)),
  check (coalesce(servicio_medico = 'otro', false) or servicio_medico_otro is null)
);

alter table ficha_registro enable row level security;

create trigger ficha_registro_actualizado
  before update on ficha_registro
  for each row execute function set_actualizado_en();

-- ---------------------------------------------------------------------
-- ficha_servicio_solicitado: servicios/áreas solicitadas al abrir la
-- Ficha Única (casillas "Servicio solicitado"). Relación N:M con
-- cat_area para mantener integridad referencial y crecer sin migración.
-- ---------------------------------------------------------------------
create table ficha_servicio_solicitado (
  ficha_id   uuid not null references ficha_registro (id) on delete restrict,
  area_id    smallint not null references cat_area (id) on delete restrict,
  creado_en  timestamptz not null default now(),
  creado_por uuid references empleado (id) on delete restrict,
  primary key (ficha_id, area_id)
);

alter table ficha_servicio_solicitado enable row level security;

-- ---------------------------------------------------------------------
-- pre_registro: lo que la usuaria llena en la app antes de ir a
-- SEMUJERES. Es la única tabla que no lleva creado_por, porque la crea
-- la propia usuaria y no una empleada. auth_user_id apunta a la cuenta
-- de Supabase Auth (por eso no se llama usuario_id).
-- Fecha de nacimiento, sexo y entidad de nacimiento se sacan de la CURP.
-- La CURP se valida con el mismo formato que en persona, para que al
-- ligarla con un expediente nunca sea rechazada.
-- estado: 'solo_app' = solo usa la app; 'ligado' = ya tiene expediente
-- (persona_id lleno). La liga la hace la base sola, por CURP (ver los
-- triggers de abajo); la app nunca debe mostrar estado ni persona_id,
-- para no revelar si esa CURP ya tenía expediente (RF-33).
-- ---------------------------------------------------------------------
create table pre_registro (
  id                            uuid primary key default gen_random_uuid(),
  auth_user_id                  uuid not null unique references auth.users (id) on delete restrict,
  curp                          text not null
                                check (curp ~ '^[A-Z][AEIOUX][A-Z]{2}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[HM](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z][0-9]$'),
  nombres                       text not null check (char_length(btrim(nombres)) between 1 and 100),
  apellido_paterno              text not null check (char_length(btrim(apellido_paterno)) between 1 and 100),
  apellido_materno              text check (char_length(apellido_materno) <= 100),
  celular                       text check (celular ~ '^[0-9]{10}$'),
  aviso_privacidad_aceptado_en  timestamptz not null,
  estado                        text not null default 'solo_app'
                                check (estado in ('solo_app', 'ligado')),
  persona_id                    uuid references persona (id) on delete restrict,
  activo                        boolean not null default true,
  creado_en                     timestamptz not null default now(),
  actualizado_en                timestamptz not null default now(),
  check ((estado = 'ligado') = (persona_id is not null))
);

alter table pre_registro enable row level security;

create trigger pre_registro_actualizado
  before update on pre_registro
  for each row execute function set_actualizado_en();

-- ---------------------------------------------------------------------
-- Liga automática por CURP entre pre_registro y persona (RF-33, RF-34).
-- Son security definer porque la usuaria de la app no puede leer persona
-- y la empleada quizá no puede escribir en pre_registro; la base hace la
-- liga por ellas.
-- 1) Cuando la usuaria se registra en la app: si ya hay una persona con
--    esa CURP, se liga. La base decide estado y persona_id (lo que mande
--    la app en esos campos se ignora).
-- ---------------------------------------------------------------------
create or replace function ligar_pre_registro_al_crear()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select p.id into new.persona_id
  from persona p
  where p.curp = new.curp;

  if new.persona_id is null then
    new.estado = 'solo_app';
  else
    new.estado = 'ligado';
  end if;
  return new;
end;
$$;

create trigger pre_registro_ligar
  before insert on pre_registro
  for each row execute function ligar_pre_registro_al_crear();

-- 2) Cuando Trabajo Social crea (o corrige la CURP de) una persona: si
--    alguien ya se había registrado en la app con esa CURP, se liga.
create or replace function ligar_persona_con_pre_registro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update pre_registro
  set persona_id = new.id,
      estado     = 'ligado'
  where curp = new.curp
    and persona_id is null;
  return null;
end;
$$;

create trigger persona_ligar_pre_registro
  after insert or update of curp on persona
  for each row execute function ligar_persona_con_pre_registro();

-- ---------------------------------------------------------------------
-- cita: agenda de Trabajo Social y Psicología (la maneja recepción) y de
-- Jurídico (agenda directo).
-- La cita se asigna a un área, no a un empleado específico.
-- estado usa las palabras de RF-06. La asistencia vive aquí
-- (asistio / no_asistio), no en atencion. La cita no lleva prioridad: la
-- prioridad del caso está en atencion.
-- Reagendar: la cita original se marca 'reagendada' y se crea una cita
-- NUEVA con reagendada_de apuntando a la original; así queda el
-- historial completo. Una cita solo se reagenda una vez (unique): si se
-- vuelve a mover, se reagenda la nueva.
-- ---------------------------------------------------------------------
create table cita (
  id               uuid primary key default gen_random_uuid(),
  persona_id       uuid not null references persona (id) on delete restrict,
  reagendada_de    uuid unique references cita (id) on delete restrict,
  area_id          smallint not null references cat_area (id) on delete restrict,
  programada_en    timestamptz not null,
  recomendada_por  text check (char_length(recomendada_por) <= 150),
  estado           public.estado_cita not null default 'agendada',
  confirmada_en    timestamptz,
  motivo_cancelacion text check (char_length(motivo_cancelacion) <= 500),  -- opcional: por qué se canceló o reagendó
  origen           public.origen_cita not null default 'regular',  -- umeca= asistencia obligatoria
  activo           boolean not null default true,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  creado_por       uuid references empleado (id) on delete restrict,
  check (estado <> 'confirmada' or confirmada_en is not null)
);

alter table cita enable row level security;

create trigger cita_actualizado
  before update on cita
  for each row execute function set_actualizado_en();

-- ---------------------------------------------------------------------
-- atencion: la HOJA DE SEGUIMIENTO de cada visita (atención y
-- seguimiento son la misma tabla; no existe una tabla seguimiento).
-- Una fila por visita y por área: si en la hoja marcan dos servicios, se
-- guardan dos atenciones. Alimenta los informes mensual y anual.
-- "Primera vez" NO se guarda: se calcula en las vistas de informes (la
-- primera atención de la persona en esa área, RN-19).
--
-- Copia de datos generales: la hoja de seguimiento vuelve a pedir
-- estado civil, ocupación, domicilio y celular en cada visita, y
-- SEMUJERES quiere ese historial. Por eso se guarda aquí una copia de
-- cómo estaban ese día. Lo que nunca cambia (nombre, CURP, fecha de
-- nacimiento) no se copia: se lee de persona.
--
-- La asistencia NO va aquí: vive en cita.estado. La próxima cita
-- tampoco: es una cita nueva en la tabla cita.
-- Los textos libres son sensibles; si alcanza el tiempo se cifran.
-- ---------------------------------------------------------------------
create table atencion (
  id                  uuid primary key default gen_random_uuid(),
  ficha_id            uuid not null references ficha_registro (id) on delete restrict,
  cita_id             uuid unique references cita (id) on delete restrict,
  area_id             smallint not null references cat_area (id) on delete restrict,  -- "Servicio"
  tipo_atencion_id    smallint not null references cat_tipo_atencion (id) on delete restrict,
  atendida_por        uuid references empleado (id) on delete restrict,
  atendida_en         timestamptz not null default now(),  -- "Fecha" y "Hora"

  -- Copia de los datos generales de ese día (hoja de seguimiento)
  estado_civil        public.estado_civil,
  ocupacion_id        smallint references cat_ocupacion (id) on delete restrict,
  ocupacion_otra      text check (char_length(ocupacion_otra) <= 150),
  celular             text check (celular ~ '^[0-9]{10}$'),
  domicilio_id        uuid references domicilio (id) on delete restrict,  -- domicilio de ese día

  -- Lo que pasó en la visita (RF-09)
  acciones_realizadas text check (char_length(acciones_realizadas) <= 5000),   -- qué se hizo
  proxima_accion      text check (char_length(proxima_accion) <= 2000),
  observaciones       text check (char_length(observaciones) <= 5000),   -- "Observaciones" de la hoja

  -- prioridad del caso al cerrar esta atención; puede ir vacía. La
  -- vigente es la de la atención más reciente que la tenga (lista de
  -- urgencias, RF-07).
  prioridad           public.prioridad_nivel,
  activo              boolean not null default true,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),
  creado_por          uuid references empleado (id) on delete restrict,
  foreign key (tipo_atencion_id, area_id) references cat_tipo_atencion (id, area_id) on delete restrict
);

alter table atencion enable row level security;

create trigger atencion_actualizado
  before update on atencion
  for each row execute function set_actualizado_en();

create or replace function validar_atencion_coherencia()
returns trigger
language plpgsql
as $$
declare
  v_ficha_persona_id uuid;
  v_dom_persona_id   uuid;
  v_cita_persona_id  uuid;
  v_cita_area_id     smallint;
begin
  select f.persona_id into v_ficha_persona_id
  from ficha_registro f
  where f.id = new.ficha_id;

  if new.domicilio_id is not null then
    select d.persona_id into v_dom_persona_id
    from domicilio d
    where d.id = new.domicilio_id;

    if v_dom_persona_id is distinct from v_ficha_persona_id then
      raise exception 'domicilio_id (%) no pertenece a la persona de la ficha %', new.domicilio_id, new.ficha_id;
    end if;
  end if;

  if new.cita_id is not null then
    select c.persona_id, c.area_id into v_cita_persona_id, v_cita_area_id
    from cita c
    where c.id = new.cita_id;

    if v_cita_persona_id is distinct from v_ficha_persona_id or v_cita_area_id is distinct from new.area_id then
      raise exception 'cita_id (%) no corresponde a la persona o al área de la atención', new.cita_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger atencion_validar_coherencia
  before insert or update on atencion
  for each row execute function validar_atencion_coherencia();

-- ---------------------------------------------------------------------
-- alerta: el botón de ayuda de la app y las urgencias que llegan por
-- teléfono o en persona. Sin coordenadas exactas (solo colonia).
-- prioridad (RF-20, RN-17): la que llega de la app entra SIEMPRE como
-- 'media'; si la persona tiene una orden de protección vigente, sube a
-- 'alta'. Lo hace solo el trigger alerta_prioridad de 04_ficha.sql (ahí
-- ya existe orden_proteccion). Las de teléfono o presencial las registra
-- el personal con la prioridad que decida (y también suben a 'alta' si
-- hay orden vigente).
-- persona_id o pre_registro_id dicen quién la mandó; pueden ir vacíos
-- (alerta anónima). creado_por va vacío si la manda la usuaria desde la
-- app y se llena si la guardia la registra.
-- tomada_en / atendida_en: cuándo alguien la tomó y cuándo se cerró.
-- ---------------------------------------------------------------------
create table alerta (
  id               uuid primary key default gen_random_uuid(),
  persona_id       uuid references persona (id) on delete restrict,
  pre_registro_id  uuid references pre_registro (id) on delete restrict,
  origen           public.origen_alerta not null,
  asentamiento_id  integer references cat_asentamiento (id) on delete restrict,
  prioridad        public.prioridad_nivel not null default 'media',
  estado           public.estado_alerta not null default 'nueva',
  tomada_en        timestamptz,
  atendida_en      timestamptz,
  atendida_por     uuid references empleado (id) on delete restrict,
  observaciones    text check (char_length(observaciones) <= 2000),
  activo           boolean not null default true,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  creado_por       uuid references empleado (id) on delete restrict,
  check (num_nonnulls(persona_id, pre_registro_id) <= 1),
  check (estado <> 'tomada' or tomada_en is not null),
  check (estado <> 'atendida' or atendida_en is not null)
);

alter table alerta enable row level security;

create trigger alerta_actualizado
  before update on alerta
  for each row execute function set_actualizado_en();

-- ---------------------------------------------------------------------
-- Índices: para la agenda, la cola de alertas, los informes y las
-- políticas (que filtran por estas columnas).
-- (ficha_registro.persona_id ya tiene índice por ser unique.)
-- ---------------------------------------------------------------------
create index ficha_servicio_solicitado_area_id_idx on ficha_servicio_solicitado (area_id);
create index pre_registro_curp_idx        on pre_registro (curp);        -- liga por CURP
create unique index pre_registro_curp_activo_uidx on pre_registro (curp) where activo;
create index pre_registro_persona_id_idx  on pre_registro (persona_id);
create index cita_persona_id_idx          on cita (persona_id);
create index cita_area_programada_idx     on cita (area_id, programada_en);  -- agenda por área y día
create index cita_programada_en_idx       on cita (programada_en);           -- citas de mañana por confirmar
create index atencion_ficha_atendida_idx  on atencion (ficha_id, atendida_en);  -- historial y urgencias
create index atencion_area_atendida_idx   on atencion (area_id, atendida_en);   -- informes
create index alerta_cola_idx              on alerta (estado, prioridad, creado_en);  -- cola de alertas
create index alerta_persona_id_idx        on alerta (persona_id);
create index alerta_pre_registro_id_idx   on alerta (pre_registro_id);
create index alerta_asentamiento_id_idx   on alerta (asentamiento_id);

-- Habilitar Realtime para la tabla de alertas de forma idempotente.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'alerta'
    ) then
      alter publication supabase_realtime add table public.alerta;
    end if;
  end if;
end $$;
