-------------------estudio socioeconomico-------------------
create table estudio_socioeconomico (
  id                  uuid primary key default gen_random_uuid(),
  ficha_id            uuid not null unique references ficha_registro (id) on delete restrict,
  
  --¿Alguien mas aporta?
  tiene_otro_aportante boolean not null default false,
  nombre_aportante     text,
  
  --ocupacion (libre como pediste)
  ocupacion           text,
  
  monto_ingreso       numeric(10, 2) check (monto_ingreso >= 0),
  frecuencia_ingreso  text check (frecuencia_ingreso in ('diario', 'semanal', 'quincenal', 'mensual', 'variable')),
  numero_dependientes smallint check (numero_dependientes >= 0),
  tiene_apoyo         boolean not null default false, -- cuenta con apoyo o beca?
  especificacion_apoyo text,
  
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),
  creado_por          uuid references empleado (id) on delete restrict
);

create trigger estudio_socioeconomico_actualizado
  before update on estudio_socioeconomico
  for each row execute function set_actualizado_en();


-- ---------------------------------------------------------------------
-- agresor: persona agresora ligada a una ficha.
-- Una ficha puede tener uno o varios. Dato muy sensible de terceros.
-- ---------------------------------------------------------------------
create table agresor (
  id                    uuid primary key default gen_random_uuid(),
  ficha_id              uuid not null references ficha_registro (id) on delete restrict,
  
  nombre                text not null,
  fecha_nacimiento      date,
  lugar_nacimiento      text,
  sexo                  text check (sexo in ('H', 'M')),
  estado_civil          text
                        check (estado_civil in ('soltero', 'casado', 'union_libre',
                                                'separado', 'divorciado', 'viudo')),
  curp                  text unique
                        check (length(curp) = 18 and curp = upper(curp)),
  parentesco            text,
  
  -- Domicilio: Referencia a la tabla domicilio (ya existente en 01_base)
  domicilio_id          uuid references domicilio (id) on delete restrict,
  
  ocupacion             text,
  
  -- Consumos
  tiene_consumo_droga   boolean not null default false,
  especificacion_droga  text,
  tiene_consumo_alcohol boolean not null default false,
  
  -- Violencia, Armas 
  utilizo_arma_u_objeto boolean not null default false,
  especificacion_arma   text,
  observaciones         text,

  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),
  creado_por            uuid references empleado (id) on delete restrict
);

create trigger agresor_actualizado
  before update on agresor
  for each row execute function set_actualizado_en();

-----ORDEN_PROTECCION------------------------------
--seguimiento administrativo de las órdenes
create table orden_proteccion (
  id               uuid primary key default gen_random_uuid(),
  ficha_id         uuid not null references ficha_registro (id) on delete restrict,
  fecha_emision    date not null,
  fecha_vigencia   date,
  estado           text not null default 'vigente'
                   check (estado in ('vigente', 'vencida', 'cancelada', 'en_tramite')),
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  creado_por       uuid references empleado (id) on delete restrict
);

create trigger orden_proteccion_actualizado
  before update on orden_proteccion
  for each row execute function set_actualizado_en();


---NOTA_AREA----------------------
-- Son notas privadas de cada área, no se comparten con otras áreas ni con la persona atendida.
create table nota_area (
  id               uuid primary key default gen_random_uuid(),
  ficha_id         uuid not null references ficha_registro (id) on delete restrict,
  area_id          smallint not null references cat_area (id) on delete restrict,
  contenido        text not null,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  creado_por       uuid references empleado (id) on delete restrict
);
create trigger nota_area_actualizado
  before update on nota_area
  for each row execute function set_actualizado_en();

-----------------------------------------------------------------------
-- derivacion: a dónde se canaliza a la persona

create table derivacion (
  id               uuid primary key default gen_random_uuid(),
  ficha_id         uuid not null references ficha_registro (id) on delete restrict,
  destino          text not null
                   check (destino in (
                     'juridico', 
                     'psicologia', 
                     'trabajo_social'
                   )),
  fecha_derivacion date not null,
  estado           text not null default 'pendiente'
                   check (estado in (
                     'pendiente', 
                     'en_proceso', 
                     'concluida', 
                     'cancelada'
                   )),
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  creado_por       uuid references empleado (id) on delete restrict
);

create trigger derivacion_actualizado
  before update on derivacion
  for each row execute function set_actualizado_en();