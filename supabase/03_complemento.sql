--------------historial clinico-----
-- Guarda antecedentes, motivo de consulta y observaciones de la 1a sesión.
-- NO duplica datos de persona; la fuente de verdad sigue siendo persona.
-- Solo lo ve el área de psicología
create table historial_clinico (
  id                        uuid primary key default gen_random_uuid(),
  persona_id                uuid not null references persona (id) on delete restrict,

  -- datos clínicos (texto libre, sensibles)
  antecedentes_familiares   text,
  antecedentes_personales   text,   -- historial psicológico previo
  motivo_consulta           text,
  observaciones_iniciales   text,   -- lo que la psicóloga anota en la 1a sesión

  -- dato propio de psicología
  tiene_atencion_psicologica_previa boolean,

  -- auditoría
  creado_en                 timestamptz not null default now(),
  actualizado_en            timestamptz not null default now(),
  creado_por                uuid references empleado (id) on delete restrict
);

create trigger historial_clinico_actualizado
  before update on historial_clinico
  for each row execute function set_actualizado_en();

-----------directorio_institucion-----------------------------------------------------------
--catálogo de instituciones y teléfonos que muestra la app (911, 089, línea de la Secretaría, fiscalia)
create table directorio_institucion (
  id             smallint generated always as identity primary key,
  nombre         text not null,
  tipo_atencion  text not null
                 check (tipo_atencion in (
                   'emergencia',
                   'denuncia',
                   'orientacion_legal',
                   'atencion_psicologica',
                   'trabajo_social',
                   'refugio',
                   'salud',
                   'linea_apoyo'
                 )),
  telefono       text not null,
  horario        text,
  orden          smallint not null default 0,--para ordenar la lista en la app
  activo         boolean not null default true,--si la institución ya no existe, se desactiva para que no aparezca en la app
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por     uuid references empleado (id) on delete restrict
);

create trigger directorio_institucion_actualizado
  before update on directorio_institucion
  for each row execute function set_actualizado_en();


--- ---------------------------------------------------------------------
-- actividad_preventiva: actividades en escuelas, comunidades, empresas.
-- Alimenta la capa del mapa por colonia.
-- ---------------------------------------------------------------------
create table actividad_preventiva (
  id                uuid primary key default gen_random_uuid(),
  tipo_actividad    text not null
                    check (tipo_actividad in (
                      'conferencia',
                      'taller',
                      'jornada_comunitaria',
                      'activacion_cultural',
                      'capacitacion',
                      'otro'
                    )),
  tipo_institucion  text not null
                    check (tipo_institucion in (
                      'escuela',
                      'empresa_privada',
                      'sector_publico',
                      'comunidad',
                      'otro'
                    )),
  nivel_educativo   text
                    check (nivel_educativo in (
                      'primaria',
                      'secundaria',
                      'preparatoria',
                      'universidad'
                    )),
  lugar             text not null,
  colonia_id        smallint references colonia (id) on delete restrict, 
  programada_en     timestamptz not null,
  numero_asistentes smallint check (numero_asistentes >= 0),
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  creado_por        uuid references empleado (id) on delete restrict
);

create trigger actividad_preventiva_actualizado
  before update on actividad_preventiva
  for each row execute function set_actualizado_en();

-- ---------------------------------------------------------------------
-- actividad_empleado: qué empleados de SEMUJERES asistieron a qué actividad.
-- Relación de muchos a muchos.
-- ---------------------------------------------------------------------
create table actividad_empleado (
  actividad_id uuid not null references actividad_preventiva (id) on delete restrict,
  empleado_id  uuid not null references empleado (id) on delete restrict,
  creado_en    timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por   uuid references empleado (id) on delete restrict,
  primary key (actividad_id, empleado_id)
);

create trigger actividad_empleado_actualizado
  before update on actividad_empleado
  for each row execute function set_actualizado_en();

-- ---------------------------------------------------------------------
-- cita: agenda de recepción.
-- La cita se asigna a un área, no a un empleado específico.
-- ---------------------------------------------------------------------
create table cita (
  id               uuid primary key default gen_random_uuid(),
  persona_id       uuid not null references persona (id) on delete restrict,
  area_id          smallint not null references cat_area (id) on delete restrict,
  programada_en    timestamptz not null,
  recomendada_por  text,
  estado           text not null default 'pendiente'
                   check (estado in (
                     'pendiente', 
                     'confirmada', 
                     'atendida', 
                     'cancelada', 
                     'no_asistio',
                     'reprogramada'
                   )),
  prioridad        text not null default 'media'
                   check (prioridad in ('baja', 'media', 'alta')),
  confirmada_en    timestamptz,
  origen           text not null default 'regular'
                   check (origen in ('regular', 'umeca')),  -- umeca= asistencia obligatoria
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  creado_por       uuid references empleado (id) on delete restrict
);

create trigger cita_actualizado
  before update on cita
  for each row execute function set_actualizado_en();




-------bitacora de acceso---------------------------------------------------
-- el registro de quién vio o cambió qué y cuándo

create table bitacora_acceso (
  id             uuid primary key default gen_random_uuid(),
  empleado_id    uuid not null references empleado (id) on delete restrict,
  accion         text not null
                 check (accion in ('ver', 'crear', 'actualizar', 'desactivar')),
  tabla_afectada text not null,
  registro_id    text,   -- text para aceptar tanto uuid como smallint
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por     uuid references empleado (id) on delete restrict
);

create trigger bitacora_acceso_actualizado
  before update on bitacora_acceso
  for each row execute function set_actualizado_en();
