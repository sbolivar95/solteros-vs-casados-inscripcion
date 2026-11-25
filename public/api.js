function inscripcionCerrada() {
  var limite = Date.parse(CIERRE_INSCRIPCION);
  return isFinite(limite) && Date.now() >= limite;
}

function mensajeError(status, datos) {
  var codigo = datos && datos.code;
  var mensaje = "";
  if (datos && typeof datos.message === "string") mensaje = datos.message;
  if (codigo === "23505" || mensaje.indexOf("duplicate key") !== -1 || mensaje.indexOf("inscripciones_celular") !== -1) {
    return "Este celular ya está inscrito.";
  }
  if (mensaje.indexOf("clave incorrecta") !== -1) return "La clave no es correcta.";
  if (mensaje.indexOf("celular invalido") !== -1) return "Escribe un celular válido, de 8 a 15 números.";
  if (mensaje.indexOf("nombre invalido") !== -1) return "Escribe el nombre, entre 2 y 80 letras.";
  if (mensaje.indexOf("monto invalido") !== -1) return "El monto tiene que ser mayor que cero.";
  if (mensaje.indexOf("clave nueva invalida") !== -1) return "La clave nueva necesita entre 4 y 40 caracteres.";
  if (mensaje.indexOf("no encontrada") !== -1) return "Esa inscripción ya no está en la lista.";
  if (mensaje.indexOf("equipo invalido") !== -1) return "Elige Solteros o Casados.";
  if (mensaje.indexOf("inscripcion cerrada") !== -1) return "La inscripción cerró el domingo a las 2:00 p.m.";
  if (status === 401 || status === 403) return "No se pudo guardar. Avisa al encargado.";
  return "No se pudo conectar. Revisa tu internet e intenta de nuevo.";
}

function llamarSupabase(ruta, metodo, cuerpo, prefer) {
  var headers = {
    apikey: SUPABASE_CLAVE_PUBLICA,
    Authorization: "Bearer " + SUPABASE_CLAVE_PUBLICA,
    Accept: "application/json"
  };
  if (cuerpo != null) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;

  return fetch(SUPABASE_URL + ruta, {
    method: metodo,
    headers: headers,
    body: cuerpo == null ? undefined : JSON.stringify(cuerpo)
  }).then(function (respuesta) {
    return respuesta.text().then(function (texto) {
      var datos = null;
      if (texto) {
        try {
          datos = JSON.parse(texto);
        } catch (e) {
          datos = null;
        }
      }
      if (!respuesta.ok) {
        var error = new Error(mensajeError(respuesta.status, datos));
        error.codigo = datos && datos.code;
        throw error;
      }
      if (typeof datos === "string") {
        try {
          return JSON.parse(datos);
        } catch (e2) {
          return datos;
        }
      }
      return datos;
    });
  });
}

function rpc(nombre, datos) {
  return llamarSupabase("/rest/v1/rpc/" + nombre, "POST", datos || {});
}

function inscribirPublico(datos) {
  return llamarSupabase("/rest/v1/inscripciones", "POST", datos, "return=minimal");
}

function limpiarNombre(valor) {
  return String(valor || "").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

function soloDigitos(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function urlPublica() {
  var ruta = window.location.pathname || "/";
  var base = ruta.replace(/admin\.html$/, "").replace(/index\.html$/, "");
  if (base.charAt(base.length - 1) !== "/") base += "/";
  return window.location.origin + base;
}

function ordenarPorInscripcion(lista) {
  var copia = Array.isArray(lista) ? lista.slice() : [];
  copia.sort(function (a, b) {
    var ta = Date.parse(a && a.creado_en);
    var tb = Date.parse(b && b.creado_en);
    if (isFinite(tb) && isFinite(ta) && tb !== ta) return tb - ta;
    if (isFinite(tb) && !isFinite(ta)) return 1;
    if (isFinite(ta) && !isFinite(tb)) return -1;
    return (Number(b && b.id) || 0) - (Number(a && a.id) || 0);
  });
  return copia;
}

function leerEstado(datos) {
  if (datos == null) return null;
  if (typeof datos === "string") {
    try {
      datos = JSON.parse(datos);
    } catch (e) {
      return null;
    }
  }
  if (Array.isArray(datos)) datos = datos.length ? datos[0] : null;
  if (!datos || typeof datos !== "object") return null;
  return datos;
}

function cuotaFija() {
  var n = Number(typeof CUOTA_PERSONA !== "undefined" ? CUOTA_PERSONA : 25);
  return isFinite(n) && n > 0 ? n : 25;
}

function textoBs(valor) {
  var n = Number(valor);
  if (!isFinite(n)) n = 0;
  if (Math.abs(n - Math.round(n)) < 0.001) return String(Math.round(n)) + " Bs";
  return String(Math.round(n * 100) / 100) + " Bs";
}

function personasPagaron(gente, equipo) {
  var n = 0;
  var i;
  if (!gente) return 0;
  for (i = 0; i < gente.length; i += 1) {
    if (equipo && gente[i].equipo !== equipo) continue;
    if (gente[i].pagado) n += 1;
  }
  return n;
}

function totalRecaudado(gente, equipo) {
  return personasPagaron(gente, equipo) * cuotaFija();
}

function mostrarCuotaFija(idNumero) {
  var elNumero = document.getElementById(idNumero);
  if (elNumero) elNumero.textContent = textoBs(cuotaFija());
}

function mostrarRecaudado(idNumero, idDetalle, gente) {
  var elNumero = document.getElementById(idNumero);
  var elDetalle = document.getElementById(idDetalle);
  var pagaron = personasPagaron(gente);
  var total = gente && gente.length ? gente.length : 0;
  if (elNumero) elNumero.textContent = textoBs(totalRecaudado(gente));
  if (elDetalle) {
    elDetalle.textContent = pagaron + (pagaron === 1 ? " pagó" : " pagaron") +
      " de " + total + " × " + textoBs(cuotaFija());
  }
}

function copiarTexto(texto) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(texto);
  }
  return new Promise(function (resolver, rechazar) {
    var campo = document.createElement("textarea");
    campo.value = texto;
    campo.setAttribute("readonly", "");
    campo.style.position = "fixed";
    campo.style.left = "-9999px";
    document.body.appendChild(campo);
    campo.select();
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(campo);
    if (ok) resolver();
    else rechazar(new Error("copy"));
  });
}
