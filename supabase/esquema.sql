-- Inscripcion Solteros vs Casados.
-- Pegar una vez en el editor SQL de este proyecto de Supabase.
-- Clave inicial del encargado: partido29
-- Se cambia despues desde la pantalla del encargado.
--
-- El monto es el total a recaudar. Cada equipo cubre la mitad,
-- y esa mitad se divide entre las personas de ese equipo.

create table if not exists ajustes (
  id integer primary key check (id = 1),
  monto numeric,
  clave text not null
);

insert into ajustes (id, clave)
values (1, 'partido29')
on conflict (id) do nothing;

create table if not exists inscripciones (
  id integer generated always as identity primary key,
  nombre text not null,
  celular text not null unique,
  equipo text not null check (equipo in ('solteros', 'casados')),
  origen text not null check (origen in ('link', 'encargado')),
  pagado boolean not null default false,
  creado_en timestamptz not null default now()
);

alter table inscripciones add column if not exists pagado boolean not null default false;

create or replace function normalizar_inscripcion()
returns trigger
language plpgsql
as $$
begin
  new.nombre := trim(regexp_replace(new.nombre, '\s+', ' ', 'g'));
  new.celular := regexp_replace(new.celular, '\D', '', 'g');

  if char_length(new.nombre) < 2 or char_length(new.nombre) > 80 then
    raise exception 'nombre invalido';
  end if;

  if new.celular !~ '^[0-9]{8,15}$' then
    raise exception 'celular invalido';
  end if;

  return new;
end;
$$;

drop trigger if exists normalizar_inscripcion_trg on inscripciones;
create trigger normalizar_inscripcion_trg
  before insert or update of nombre, celular, equipo
  on inscripciones
  for each row
  execute function normalizar_inscripcion();

alter table ajustes enable row level security;
alter table inscripciones enable row level security;

drop policy if exists inscribir_publico on inscripciones;
create policy inscribir_publico
  on inscripciones
  for insert
  to anon
  with check (
    origen = 'link'
    and equipo in ('solteros', 'casados')
    and pagado = false
  );

revoke all on table ajustes from public, anon, authenticated;
revoke all on table inscripciones from public, anon, authenticated;
grant insert on table inscripciones to anon;
grant usage, select on sequence inscripciones_id_seq to anon;

create or replace function exigir_clave(p_clave text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_clave is null
    or char_length(p_clave) < 4
    or not exists (select 1 from ajustes where id = 1 and clave = p_clave)
  then
    raise exception 'clave incorrecta';
  end if;
end;
$$;

create or replace function resumen()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_monto numeric;
  v_monto_equipo numeric;
  v_solteros integer;
  v_casados integer;
  v_pagados_solteros integer;
  v_pagados_casados integer;
  v_cuota_solteros integer;
  v_cuota_casados integer;
begin
  select monto into v_monto from ajustes where id = 1;

  if v_monto is not null then
    v_monto_equipo := v_monto / 2;
  end if;

  select count(*) into v_solteros from inscripciones where equipo = 'solteros';
  select count(*) into v_casados from inscripciones where equipo = 'casados';
  select count(*) into v_pagados_solteros from inscripciones where equipo = 'solteros' and pagado;
  select count(*) into v_pagados_casados from inscripciones where equipo = 'casados' and pagado;

  if v_solteros > 0 and v_monto_equipo is not null then
    v_cuota_solteros := ceil(v_monto_equipo / v_solteros);
  end if;

  if v_casados > 0 and v_monto_equipo is not null then
    v_cuota_casados := ceil(v_monto_equipo / v_casados);
  end if;

  return json_build_object(
    'monto', v_monto,
    'monto_equipo', v_monto_equipo,
    'solteros', v_solteros,
    'casados', v_casados,
    'pagados_solteros', v_pagados_solteros,
    'pagados_casados', v_pagados_casados,
    'cuota_solteros', v_cuota_solteros,
    'cuota_casados', v_cuota_casados,
    'junta_solteros', case when v_cuota_solteros is null then null else v_cuota_solteros * v_solteros end,
    'junta_casados', case when v_cuota_casados is null then null else v_cuota_casados * v_casados end
  );
end;
$$;

create or replace function entrar(p_clave text)
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'ok', exists (
      select 1
      from ajustes
      where id = 1
        and p_clave is not null
        and char_length(p_clave) >= 4
        and clave = p_clave
    )
  );
$$;

create or replace function listar(p_clave text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  perform exigir_clave(p_clave);

  return coalesce(
    (
      select json_agg(
        json_build_object(
          'id', id,
          'nombre', nombre,
          'celular', celular,
          'equipo', equipo,
          'origen', origen,
          'pagado', pagado,
          'creado_en', creado_en
        )
        order by pagado, creado_en desc
      )
      from inscripciones
    ),
    '[]'::json
  );
end;
$$;

drop function if exists guardar_ajustes(text, numeric, text, text, text);

create or replace function guardar_ajustes(p_clave text, p_monto numeric)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  perform exigir_clave(p_clave);

  if p_monto is not null and p_monto <= 0 then
    raise exception 'monto invalido';
  end if;

  update ajustes
  set monto = p_monto
  where id = 1;

  return resumen();
end;
$$;

create or replace function inscribir_encargado(
  p_clave text,
  p_nombre text,
  p_celular text,
  p_equipo text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  perform exigir_clave(p_clave);

  if p_equipo not in ('solteros', 'casados') then
    raise exception 'equipo invalido';
  end if;

  insert into inscripciones (nombre, celular, equipo, origen)
  values (p_nombre, p_celular, p_equipo, 'encargado');

  return resumen();
end;
$$;

create or replace function cambiar_equipo(
  p_clave text,
  p_id integer,
  p_equipo text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  perform exigir_clave(p_clave);

  if p_equipo not in ('solteros', 'casados') then
    raise exception 'equipo invalido';
  end if;

  update inscripciones
  set equipo = p_equipo
  where id = p_id;

  if not found then
    raise exception 'no encontrada';
  end if;

  return resumen();
end;
$$;

create or replace function marcar_pago(p_clave text, p_id integer, p_pagado boolean)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  perform exigir_clave(p_clave);

  update inscripciones
  set pagado = coalesce(p_pagado, false)
  where id = p_id;

  if not found then
    raise exception 'no encontrada';
  end if;

  return resumen();
end;
$$;

create or replace function quitar(p_clave text, p_id integer)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  perform exigir_clave(p_clave);

  delete from inscripciones
  where id = p_id;

  if not found then
    raise exception 'no encontrada';
  end if;

  return resumen();
end;
$$;

create or replace function cambiar_clave(p_clave text, p_nueva text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  perform exigir_clave(p_clave);

  if p_nueva is null or char_length(trim(p_nueva)) < 4 or char_length(trim(p_nueva)) > 40 then
    raise exception 'clave nueva invalida';
  end if;

  update ajustes
  set clave = trim(p_nueva)
  where id = 1;

  return json_build_object('ok', true);
end;
$$;

revoke all on function normalizar_inscripcion() from public;
grant execute on function normalizar_inscripcion() to anon;

revoke all on function exigir_clave(text) from public;
revoke all on function resumen() from public;
revoke all on function entrar(text) from public;
revoke all on function listar(text) from public;
revoke all on function guardar_ajustes(text, numeric) from public;
revoke all on function inscribir_encargado(text, text, text, text) from public;
revoke all on function cambiar_equipo(text, integer, text) from public;
revoke all on function marcar_pago(text, integer, boolean) from public;
revoke all on function quitar(text, integer) from public;
revoke all on function cambiar_clave(text, text) from public;

grant execute on function resumen() to anon;
grant execute on function entrar(text) to anon;
grant execute on function listar(text) to anon;
grant execute on function guardar_ajustes(text, numeric) to anon;
grant execute on function inscribir_encargado(text, text, text, text) to anon;
grant execute on function cambiar_equipo(text, integer, text) to anon;
grant execute on function marcar_pago(text, integer, boolean) to anon;
grant execute on function quitar(text, integer) to anon;
grant execute on function cambiar_clave(text, text) to anon;

notify pgrst, 'reload schema';
