-- =====================================================================
-- 03_complemento.sql
-- Qué contiene: historial clínico de psicología, directorio de
-- instituciones de la app, actividades preventivas (charlas) y quién
-- asistió y bitácora de accesos (con sus funciones).
-- Responsable: Sara (archivo iniciado por su compañera)
-- Depende de: 01_base.sql (empleado, usuario_externo, cat_asentamiento) y
-- 02_atencion.sql (ficha_registro, cita y los triggers de bitácora de
-- sus tablas), así que se corre después del 02.
-- Reglas de nombres y tipos: ver el encabezado de 01_base.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- historial_clinico (RF-11): antecedentes, motivo de consulta y
-- observaciones de la 1a sesión de psicología. Uno por expediente
-- (ficha). NO duplica datos personales: se leen de persona y de la
-- ficha. Solo lo ve el área de psicología.
-- ---------------------------------------------------------------------
create table historial_clinico (
  id                        uuid primary key default gen_random_uuid(),
  ficha_id                  uuid not null unique references ficha_registro (id) on delete restrict,

  -- datos clínicos (texto libre, sensibles)
  antecedentes_familiares   text check (char_length(antecedentes_familiares) <= 5000),
  antecedentes_personales   text check (char_length(antecedentes_personales) <= 5000),   -- historial psicológico previo
  motivo_consulta           text check (char_length(motivo_consulta) <= 5000),
  observaciones_iniciales   text check (char_length(observaciones_iniciales) <= 5000),   -- lo que la psicóloga anota en la 1a sesión

  -- dato propio de psicología
  tiene_atencion_psicologica_previa boolean,

  -- auditoría
  activo                    boolean not null default true,
  creado_en                 timestamptz not null default now(),
  actualizado_en            timestamptz not null default now(),
  creado_por                uuid references empleado (id) on delete restrict
);

alter table historial_clinico enable row level security;

create trigger historial_clinico_actualizado
  before update on historial_clinico
  for each row execute function set_actualizado_en();

-----------directorio_institucion-----------------------------------------------------------
-- catálogo de instituciones y teléfonos que muestra la app (911, 089, línea de la Secretaría, fiscalía)
-- categoria = qué clase de institución es (no confundir con
-- cat_tipo_atencion, que son los tipos de atención de SEMUJERES).
-- Las dependencias públicas pueden incluir domicilio estructurado opcional;
-- por seguridad, si categoria = 'refugio' la BD prohíbe guardar cualquier
-- campo de dirección.
create table directorio_institucion (
  id              smallint generated always as identity primary key,
  nombre          text not null check (char_length(btrim(nombre)) between 1 and 150),
  categoria       public.categoria_institucion not null,
  telefono        text not null check (telefono ~ '^[0-9]{3,15}$'),
  horario         text check (char_length(horario) <= 150),
  es_24_horas     boolean not null default false,
  asentamiento_id integer references cat_asentamiento (id) on delete restrict,
  -- Fallback cuando asentamiento_id es null (p. ej. fuera de catálogo local)
  codigo_postal   text check (codigo_postal ~ '^[0-9]{5}$'),
  calle           text check (char_length(calle) <= 150),
  numero_exterior text check (char_length(numero_exterior) <= 30),
  numero_interior text check (char_length(numero_interior) <= 30),
  referencias     text check (char_length(referencias) <= 250),
  orden           smallint not null default 0 check (orden between 0 and 1000),--para ordenar la lista en la app
  activo          boolean not null default true,--si la institución ya no existe, se desactiva para que no aparezca en la app
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  creado_por      uuid references empleado (id) on delete restrict,
  check (asentamiento_id is null or codigo_postal is null),
  check (
    categoria <> 'refugio'
    or (
      asentamiento_id is null
      and codigo_postal is null
      and calle is null
      and numero_exterior is null
      and numero_interior is null
      and referencias is null
    )
  )
);

alter table directorio_institucion enable row level security;

create trigger directorio_institucion_actualizado
  before update on directorio_institucion
  for each row execute function set_actualizado_en();

-- ---------------------------------------------------------------------
-- cat_tipo_actividad: tipos de actividad preventiva. Es catálogo porque
-- la lista crece. Valores tomados de los carteles de los 16 Días de
-- Activismo de SEMUJERES (noviembre-diciembre).
-- ---------------------------------------------------------------------
create table cat_tipo_actividad (
  id     smallint generated always as identity primary key,
  clave  text not null unique check (char_length(btrim(clave)) between 1 and 50),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 120)
);

alter table cat_tipo_actividad enable row level security;

insert into cat_tipo_actividad (clave, nombre) values
  ('conferencia',      'Conferencia'),
  ('taller',           'Taller'),
  ('capacitacion',     'Capacitación'),
  ('jornada',          'Jornada comunitaria o de prevención'),
  ('conversatorio',    'Conversatorio'),
  ('caminata',         'Caminata'),
  ('loteria',          'Lotería de los Derechos de las Mujeres'),
  ('activacion',       'Activación'),
  ('iluminacion',      'Iluminación'),
  ('difusion',         'Difusión de servicios'),
  ('modulo_servicios', 'Módulo de servicios'),
  ('otro',             'Otro');

-- ---------------------------------------------------------------------
-- actividad_preventiva: actividades en escuelas, comunidades, empresas
-- (RF-16). Alimenta la capa del mapa por colonia.
-- sede = nombre del plantel, empresa, parque o recinto; direccion y
-- referencias son opcionales dentro de la colonia (asentamiento_id).
-- nivel_educativo solo se llena si la actividad fue en una escuela.
-- ---------------------------------------------------------------------
create table actividad_preventiva (
  id                uuid primary key default gen_random_uuid(),
  titulo            text not null check (char_length(btrim(titulo)) between 1 and 200),  -- p. ej. 'Violencia en el noviazgo'
  tipo_actividad_id smallint not null references cat_tipo_actividad (id) on delete restrict,
  tipo_institucion  public.tipo_institucion_actividad not null,
  nivel_educativo   public.nivel_educativo,
  sede              text not null check (char_length(btrim(sede)) between 1 and 200), -- nombre de escuela, empresa, parque o recinto
  direccion         text check (char_length(direccion) <= 250),
  referencias       text check (char_length(referencias) <= 250),
  asentamiento_id   integer references cat_asentamiento (id) on delete restrict,
  programada_en     timestamptz not null,
  numero_asistentes smallint check (numero_asistentes between 0 and 10000),
  activo            boolean not null default true,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  creado_por        uuid references empleado (id) on delete restrict,
  check (nivel_educativo is null or tipo_institucion = 'escuela')
);

alter table actividad_preventiva enable row level security;

create trigger actividad_preventiva_actualizado
  before update on actividad_preventiva
  for each row execute function set_actualizado_en();

-- ---------------------------------------------------------------------
-- actividad_empleado: qué empleados de SEMUJERES asistieron a qué actividad.
-- Relación de muchos a muchos. El unique evita anotar dos veces al mismo
-- empleado en la misma actividad.
-- ---------------------------------------------------------------------
create table actividad_empleado (
  id                      uuid primary key default gen_random_uuid(),
  actividad_preventiva_id uuid not null references actividad_preventiva (id) on delete restrict,
  empleado_id             uuid not null references empleado (id) on delete restrict,
  activo                  boolean not null default true,
  creado_en               timestamptz not null default now(),
  actualizado_en          timestamptz not null default now(),
  creado_por              uuid references empleado (id) on delete restrict,
  unique (actividad_preventiva_id, empleado_id)
);

alter table actividad_empleado enable row level security;

create trigger actividad_empleado_actualizado
  before update on actividad_empleado
  for each row execute function set_actualizado_en();

-- ---------------------------------------------------------------------
-- bitacora_acceso (RF-22): quién vio o cambió qué y cuándo.
-- Solo se escribe: no lleva actualizado_en, trigger ni activo, y nadie
-- debe poder editar ni borrar filas (las políticas no darán update ni
-- delete). Tampoco lleva creado_por: quién lo hizo ya está en
-- empleado_id / usuario_externo_id.
-- Quién: empleado_id si fue personal de SEMUJERES, usuario_externo_id si
-- fue UMECA; los dos vacíos = la usuaria desde la app o un proceso de la
-- base (por ejemplo, el seed).
-- Cómo se llena:
--   crear / actualizar / desactivar -> solo, con el trigger
--                                      registrar_cambio() (abajo y en 04)
--   ver -> la web llama registrar_consulta() al abrir un expediente o
--          los datos de la persona agresora (RF-05)
-- ---------------------------------------------------------------------
create table bitacora_acceso (
  id                 uuid primary key default gen_random_uuid(),
  empleado_id        uuid references empleado (id) on delete restrict,
  usuario_externo_id uuid references usuario_externo (id) on delete restrict,
  accion             public.accion_bitacora not null,
  tabla_afectada     text not null check (char_length(btrim(tabla_afectada)) between 1 and 80),
  registro_id        text check (char_length(registro_id) <= 100),   -- text para aceptar tanto uuid como smallint
  creado_en          timestamptz not null default now(),
  check (num_nonnulls(empleado_id, usuario_externo_id) <= 1)
);

alter table bitacora_acceso enable row level security;

-- ---------------------------------------------------------------------
-- registrar_cambio(): trigger que anota en la bitácora cada alta y cada
-- cambio. Si el cambio fue poner activo = false, lo anota como
-- 'desactivar'. Es security definer para poder escribir en la bitácora
-- aunque quien hace el cambio no tenga permiso sobre ella.
-- Las tablas que lo usan deben tener id y activo.
-- ---------------------------------------------------------------------
create or replace function registrar_cambio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_accion public.accion_bitacora;
begin
  if tg_op = 'INSERT' then
    v_accion = 'crear';
  elsif old.activo and not new.activo then
    v_accion = 'desactivar';
  else
    v_accion = 'actualizar';
  end if;

  insert into bitacora_acceso (empleado_id, usuario_externo_id, accion,
                               tabla_afectada, registro_id)
  values (
    (select e.id from empleado e where e.id = auth.uid()),
    (select u.id from usuario_externo u where u.id = auth.uid()),
    v_accion,
    tg_table_name,
    new.id::text
  );
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- registrar_consulta(): la web la llama (como RPC) cada vez que alguien
-- abre un expediente o los datos de la persona agresora. Solo personal
-- activo o UMECA activo pueden usarla.
-- ---------------------------------------------------------------------
create or replace function registrar_consulta(p_tabla text, p_registro_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empleado_id        uuid;
  v_usuario_externo_id uuid;
begin
  select e.id into v_empleado_id
  from empleado e where e.id = auth.uid() and e.activo;

  select u.id into v_usuario_externo_id
  from usuario_externo u where u.id = auth.uid() and u.activo;

  if v_empleado_id is null and v_usuario_externo_id is null then
    raise exception 'Sin permiso para registrar consultas';
  end if;

  insert into bitacora_acceso (empleado_id, usuario_externo_id, accion,
                               tabla_afectada, registro_id)
  values (v_empleado_id, v_usuario_externo_id, 'ver', p_tabla, p_registro_id);
end;
$$;

revoke execute on function registrar_consulta(text, text) from public, anon;
grant execute on function registrar_consulta(text, text) to authenticated;

-- Bitácora automática de cambios en las tablas de 01, 02 y 03 que tocan
-- cuentas o expedientes. Las de 04 se agregan en 04_ficha.sql.
create trigger empleado_bitacora        after insert or update on empleado        for each row execute function registrar_cambio();
create trigger usuario_externo_bitacora after insert or update on usuario_externo for each row execute function registrar_cambio();
create trigger persona_bitacora         after insert or update on persona         for each row execute function registrar_cambio();
create trigger domicilio_bitacora       after insert or update on domicilio       for each row execute function registrar_cambio();
create trigger ficha_registro_bitacora  after insert or update on ficha_registro  for each row execute function registrar_cambio();
create trigger pre_registro_bitacora    after insert or update on pre_registro    for each row execute function registrar_cambio();
create trigger atencion_bitacora        after insert or update on atencion        for each row execute function registrar_cambio();
create trigger alerta_bitacora          after insert or update on alerta          for each row execute function registrar_cambio();
create trigger historial_clinico_bitacora after insert or update on historial_clinico for each row execute function registrar_cambio();
create trigger cita_bitacora            after insert or update on cita            for each row execute function registrar_cambio();

-- ---------------------------------------------------------------------
-- Índices.
-- (historial_clinico.ficha_id y actividad_empleado ya tienen índice por
-- ser unique.)
-- ---------------------------------------------------------------------
create index directorio_institucion_asentamiento_id_idx on directorio_institucion (asentamiento_id);
create index actividad_preventiva_programada_idx on actividad_preventiva (programada_en);
create index actividad_preventiva_asentamiento_id_idx on actividad_preventiva (asentamiento_id);
create index actividad_empleado_empleado_id_idx  on actividad_empleado (empleado_id);
create index bitacora_acceso_registro_idx        on bitacora_acceso (tabla_afectada, registro_id);  -- quién vio este expediente
create index bitacora_acceso_empleado_id_idx     on bitacora_acceso (empleado_id);
create index bitacora_acceso_creado_en_idx       on bitacora_acceso (creado_en);
