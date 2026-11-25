-- ---------------------------------------------------------------------
-- ficha_registro: expediente formal de ingreso 
-- ---------------------------------------------------------------------
create table ficha_registro (
  id                  uuid primary key default gen_random_uuid(),
  persona_id          uuid not null references persona (id) on delete restrict,
  
  folio               text not null unique,
  fecha_ingreso       date not null default current_date,
  hora_ingreso        timestamptz not null default now(),
  
  servicio_solicitado text not null
                      check (servicio_solicitado in ('psicologia', 'juridico', 'trabajo_social')),
  
  observaciones       text, 
  
  estado              text not null default 'abierto'
                      check (estado in ('abierto', 'en_proceso', 'cerrado', 'archivado')),
  
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),
  creado_por          uuid references empleado (id) on delete restrict
);

create trigger ficha_registro_actualizado
  before update on ficha_registro
  for each row execute function set_actualizado_en();

-- ---------------------------------------------------------------------
create table atencion (
  id                 uuid primary key default gen_random_uuid(),
  
  -- Quién y dónde
  ficha_id           uuid not null references ficha_registro (id) on delete restrict,
  area_id            smallint not null references cat_area (id) on delete restrict,
  tipo_atencion_id   text not null, 
                     -- ej. 'primera_vez', 'seguimiento', 'asesoria'
  area_origen_id     smallint references cat_area (id) on delete restrict,
  atendida_por       uuid not null references empleado (id) on delete restrict, 
  
  -- Cuándo
  fecha_atencion     date not null default current_date,
  hora_atencion      timestamptz not null default now(),
  
  -- Asistencia
  asistencia         text not null default 'asistio'
                     check (asistencia in ('asistio', 'no_asistio', 'cancelo')),
                     
  -- La hoja de seguimiento
  acciones_realizadas text,
  proxima_accion     text,
  fecha_proxima_cita date,
  observaciones      text,
  
  -- Prioridad
  prioridad          text check (prioridad in ('alta', 'media', 'baja')),
  
  
  activo             boolean not null default true,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),
  creado_por         uuid references empleado (id) on delete restrict
);

create trigger atencion_actualizado
  before update on atencion
  for each row execute function set_actualizado_en();


-- ---------------------------------------------------------------------
-- pre_registro: datos iniciales tomados desde la app móvil
-- Al llegar a la Secretaría, se busca este registro para abrir la ficha.
-- ---------------------------------------------------------------------
create table pre_registro (
  id             uuid primary key default gen_random_uuid(),
  
  nombre         text not null,
  curp           text unique 
                 check (length(curp) = 18 and curp = upper(curp)),
                 
  -- Cuando la mujer llega a la Secretaría, este campo se llena con el ID de la ficha
  ficha_id       uuid references ficha_registro (id) on delete restrict, 
                 
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por     uuid references empleado (id) on delete restrict
);

create trigger pre_registro_actualizado
  before update on pre_registro
  for each row execute function set_actualizado_en();