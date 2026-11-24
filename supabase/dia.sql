-- Corre esto en el editor SQL si las tablas ya existen.
-- Agrega la lista del día del partido: vino, juega y quien llegó sin inscribirse.

alter table inscripciones add column if not exists vino boolean not null default false;
alter table inscripciones add column if not exists juega boolean not null default false;
alter table inscripciones alter column celular drop not null;
alter table inscripciones drop constraint if exists inscripciones_origen_check;
alter table inscripciones add constraint inscripciones_origen_check
  check (origen in ('link', 'encargado', 'dia'));

create or replace function normalizar_inscripcion()
returns trigger
language plpgsql
as $$
begin
  new.nombre := trim(regexp_replace(new.nombre, '\s+', ' ', 'g'));
  new.celular := regexp_replace(coalesce(new.celular, ''), '\D', '', 'g');
  if new.celular = '' then
    new.celular := null;
  end if;

  if TG_OP = 'INSERT' and now() >= timestamptz '2026-11-29 14:00:00-04:00' then
    raise exception 'inscripcion cerrada';
  end if;

  if char_length(new.nombre) < 2 or char_length(new.nombre) > 80 then
    raise exception 'nombre invalido';
  end if;

  if new.celular is null then
    if new.origen not in ('encargado', 'dia') then
      raise exception 'celular invalido';
    end if;
  elsif new.celular !~ '^[0-9]{8,15}$' then
    raise exception 'celular invalido';
  end if;

  return new;
end;
$$;

drop policy if exists inscribir_publico on inscripciones;
create policy inscribir_publico
  on inscripciones
  for insert
  to anon
  with check (
    origen = 'link'
    and equipo in ('solteros', 'casados')
    and pagado = false
    and vino = false
    and juega = false
  );

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
          'vino', vino,
          'juega', juega,
          'creado_en', creado_en
        )
        order by lower(nombre)
      )
      from inscripciones
    ),
    '[]'::json
  );
end;
$$;

create or replace function marcar_dia(
  p_clave text,
  p_id integer,
  p_vino boolean,
  p_juega boolean
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vino boolean := coalesce(p_vino, false);
  v_juega boolean := coalesce(p_juega, false);
begin
  perform exigir_clave(p_clave);

  if v_juega then
    v_vino := true;
  end if;
  if not v_vino then
    v_juega := false;
  end if;

  update inscripciones
  set vino = v_vino, juega = v_juega
  where id = p_id;

  if not found then
    raise exception 'no encontrada';
  end if;

  return json_build_object('ok', true);
end;
$$;

create or replace function llegar_sin_inscribir(
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

  insert into inscripciones (nombre, celular, equipo, origen, vino)
  values (p_nombre, p_celular, p_equipo, 'dia', true);

  return json_build_object('ok', true);
end;
$$;

grant execute on function marcar_dia(text, integer, boolean, boolean) to anon;
grant execute on function llegar_sin_inscribir(text, text, text, text) to anon;

notify pgrst, 'reload schema';
