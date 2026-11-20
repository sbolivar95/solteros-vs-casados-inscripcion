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
