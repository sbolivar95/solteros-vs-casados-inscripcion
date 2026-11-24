 -- Cierra toda inscripción el domingo 29 de noviembre de 2026 a las 14:00 (UTC-4).
-- Pegar en el editor SQL del proyecto.

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
