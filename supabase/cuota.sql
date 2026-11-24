-- La cuota por persona es el monto total dividido entre todos los inscritos.
-- Pegar en el editor SQL del proyecto.

create or replace function resumen()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_monto numeric;
  v_solteros integer;
  v_casados integer;
  v_total integer;
  v_pagados_solteros integer;
  v_pagados_casados integer;
  v_cuota integer;
begin
  select monto into v_monto from ajustes where id = 1;

  select count(*) into v_solteros from inscripciones where equipo = 'solteros';
  select count(*) into v_casados from inscripciones where equipo = 'casados';
  select count(*) into v_pagados_solteros from inscripciones where equipo = 'solteros' and pagado;
  select count(*) into v_pagados_casados from inscripciones where equipo = 'casados' and pagado;

  v_total := v_solteros + v_casados;

  if v_total > 0 and v_monto is not null then
    v_cuota := ceil(v_monto / v_total);
  end if;

  return json_build_object(
    'monto', v_monto,
    'solteros', v_solteros,
    'casados', v_casados,
    'pagados_solteros', v_pagados_solteros,
    'pagados_casados', v_pagados_casados,
    'cuota', v_cuota,
    'cuota_solteros', v_cuota,
    'cuota_casados', v_cuota,
    'junta', case when v_cuota is null then null else v_cuota * v_total end
  );
end;
$$;
