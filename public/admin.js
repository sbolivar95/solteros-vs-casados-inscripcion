var CLAVE_SESION = "svs_clave";
var clave = "";
var estado = null;
var gente = [];
var equipoAlta = "";

function entero(valor) {
  if (valor == null || valor === "") return null;
  var n = Number(valor);
  if (!isFinite(n)) return null;
  return Math.round(n);
}

function textoDinero(valor) {
  if (valor == null || valor === "") return "";
  var n = Number(valor);
  if (!isFinite(n)) return "";
  if (Math.abs(n - Math.round(n)) < 0.001) return String(Math.round(n));
  return String(Math.round(n * 100) / 100);
}

function ponerTexto(id, texto) {
  document.getElementById(id).textContent = texto || "";
}

function montoParaCampo(valor) {
  var n = entero(valor);
  if (n == null) {
    if (valor == null || valor === "") return "";
    var crudo = Number(valor);
    return isFinite(crudo) ? String(crudo) : "";
  }
  return String(n);
}

function fechaCorta(iso) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  try {
    return d.toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return d.toLocaleString();
  }
}

function abrirPanel() {
  document.documentElement.className += document.documentElement.className.indexOf("hay-clave") === -1 ? " hay-clave" : "";
  document.getElementById("entrada").hidden = true;
  document.getElementById("panel").hidden = false;
}

function cerrarPanel() {
  clave = "";
  try { localStorage.removeItem(CLAVE_SESION); } catch (e) {}
  document.documentElement.className = document.documentElement.className.replace(/\bhay-clave\b/g, "");
  document.getElementById("panel").hidden = true;
  document.getElementById("entrada").hidden = false;
  document.getElementById("clave").value = "";
}

function aplicarCierreAlta() {
  if (!inscripcionCerrada()) return;
  document.getElementById("alta").hidden = true;
  document.getElementById("aviso-cierre-alta").hidden = false;
}

function montoDelCampo() {
  var campo = document.getElementById("monto");
  if (!campo) return null;
  var texto = campo.value.replace(",", ".").replace(/^\s+|\s+$/g, "");
  return texto ? texto : null;
}

function pintarCuotaPersona() {
  mostrarCuota("cuota-persona", "cuota-detalle", estado, gente, montoDelCampo());
}

function pintarEstado() {
  if (estado) {
    document.getElementById("n-solteros").textContent = String(estado.solteros || 0);
    document.getElementById("n-casados").textContent = String(estado.casados || 0);
    if (document.activeElement !== document.getElementById("monto")) {
      document.getElementById("monto").value = montoParaCampo(estado.monto);
    }
    pintarCuota("solteros", "c-solteros", "j-solteros", estado.pagados_solteros);
    pintarCuota("casados", "c-casados", "j-casados", estado.pagados_casados);
  }
  pintarCuotaPersona();
}

function pintarCuota(equipo, idCuota, idJunta, pagados) {
  var cantidad = equipo === "solteros" ? (estado && estado.solteros) : (estado && estado.casados);
  var cuotaEl = document.getElementById(idCuota);
  var juntaEl = document.getElementById(idJunta);
  var cuota = cuotaPorPersona(estado, gente, montoDelCampo());
  if (!cantidad) {
    cuotaEl.textContent = "Nadie inscrito";
    juntaEl.textContent = "";
    return;
  }
  if (cuota == null) {
    cuotaEl.textContent = "Aún sin monto";
    juntaEl.textContent = (pagados || 0) + " de " + cantidad + " ya pagaron.";
    return;
  }
  cuotaEl.textContent = textoDinero(cuota) + " por persona";
  juntaEl.textContent = "Ya pagaron " + (pagados || 0) + " de " + cantidad + ".";
}

function pintarLista() {
  var filtro = limpiarNombre(document.getElementById("buscar").value).toLowerCase();
  var digitos = soloDigitos(filtro);
  var raiz = document.getElementById("lista");
  raiz.innerHTML = "";
  var visibles = [];
  var i;
  for (i = 0; i < gente.length; i += 1) {
    var persona = gente[i];
    var nombre = String(persona.nombre || "").toLowerCase();
    var celular = String(persona.celular || "");
    var coincide = !filtro || nombre.indexOf(filtro) !== -1 || (digitos && celular.indexOf(digitos) !== -1);
    if (coincide) visibles.push(persona);
  }
  if (!visibles.length) {
    var vacio = document.createElement("p");
    vacio.className = "ayuda";
    vacio.textContent = gente.length ? "Nadie coincide con la búsqueda." : "Nadie inscrito todavía.";
    raiz.appendChild(vacio);
    return;
  }
  for (i = 0; i < visibles.length; i += 1) raiz.appendChild(tarjetaPersona(visibles[i]));
}

function tarjetaPersona(persona) {
  var articulo = document.createElement("article");
  articulo.className = persona.pagado ? "persona pagada" : "persona";
  var titulo = document.createElement("h3");
  titulo.textContent = persona.nombre;
  var tel = document.createElement("p");
  var enlace = document.createElement("a");
  enlace.className = "telefono";
  enlace.href = "tel:" + persona.celular;
  enlace.textContent = persona.celular;
  tel.appendChild(enlace);
  var meta = document.createElement("p");
  meta.className = "meta";
  var origen = persona.origen === "encargado" ? "Por el encargado" : "Por el link";
  var cuando = fechaCorta(persona.creado_en);
  meta.textContent = (persona.equipo === "solteros" ? "Solteros" : "Casados") + " · " + origen + (cuando ? " · " + cuando : "");
  articulo.appendChild(titulo);
  articulo.appendChild(tel);
  articulo.appendChild(meta);

  var pago = document.createElement("label");
  pago.className = "pago";
  var caja = document.createElement("input");
  caja.type = "checkbox";
  caja.checked = !!persona.pagado;
  caja.addEventListener("change", function () { marcarPago(persona, caja.checked); });
  var textoPago = document.createElement("span");
  textoPago.textContent = "Ya pagó";
  pago.appendChild(caja);
  pago.appendChild(textoPago);
  articulo.appendChild(pago);

  var otro = persona.equipo === "solteros" ? "casados" : "solteros";
  var pasar = document.createElement("button");
  pasar.type = "button";
  pasar.className = "secundario";
  pasar.textContent = otro === "casados" ? "Pasar a Casados" : "Pasar a Solteros";
  pasar.addEventListener("click", function () { mover(persona, otro); });

  var quitarBtn = document.createElement("button");
  quitarBtn.type = "button";
  quitarBtn.className = "peligro";
  quitarBtn.textContent = "Quitar";
  quitarBtn.addEventListener("click", function () { eliminar(persona); });

  articulo.appendChild(pasar);
  articulo.appendChild(quitarBtn);
  return articulo;
}

function refrescar() {
  return Promise.all([
    rpc("resumen").catch(function () { return null; }),
    rpc("listar", { p_clave: clave })
  ]).then(function (partes) {
    estado = leerEstado(partes[0]);
    gente = ordenarPorInscripcion(Array.isArray(partes[1]) ? partes[1] : []);
    pintarEstado();
    pintarLista();
  });
}

function entrarCon(valor) {
  return rpc("entrar", { p_clave: valor }).then(function (respuesta) {
    if (!respuesta || !respuesta.ok) {
      var error = new Error("La clave no es correcta.");
      throw error;
    }
    clave = valor;
    try { localStorage.setItem(CLAVE_SESION, valor); } catch (e) {}
    abrirPanel();
    aplicarCierreAlta();
    return refrescar();
  });
}

function elegirAlta(equipo) {
  equipoAlta = equipo;
  document.getElementById("equipo-solteros").setAttribute("aria-pressed", equipo === "solteros" ? "true" : "false");
  document.getElementById("equipo-casados").setAttribute("aria-pressed", equipo === "casados" ? "true" : "false");
}

function leerMonto() {
  var texto = document.getElementById("monto").value.replace(",", ".").replace(/^\s+|\s+$/g, "");
  if (!texto) return null;
  var n = Number(texto);
  if (!isFinite(n) || n <= 0) return { error: "El monto tiene que ser mayor que cero." };
  return n;
}

document.getElementById("entrada").addEventListener("submit", function (evento) {
  evento.preventDefault();
  var valor = document.getElementById("clave").value;
  var boton = document.getElementById("boton-entrar");
  boton.disabled = true;
  entrarCon(valor).catch(function (error) {
    ponerTexto("error-entrada", error.message || "No se pudo entrar.");
  }).then(function () {
    boton.disabled = false;
  });
});

document.getElementById("ajustes").addEventListener("submit", function (evento) {
  evento.preventDefault();
  var monto = leerMonto();
  if (monto && monto.error) {
    ponerTexto("error-ajustes", monto.error);
    return;
  }
  ponerTexto("error-ajustes", "");
  ponerTexto("ok-ajustes", "");
  var boton = document.getElementById("guardar-ajustes");
  boton.disabled = true;
  rpc("guardar_ajustes", {
    p_clave: clave,
    p_monto: monto
  }).then(function (datos) {
    estado = leerEstado(datos) || estado || {};
    estado.monto = monto;
    pintarEstado();
    ponerTexto("ok-ajustes", "Monto guardado.");
  }).catch(function (error) {
    ponerTexto("error-ajustes", error.message || "No se pudo guardar.");
  }).then(function () {
    boton.disabled = false;
  });
});

document.getElementById("equipo-solteros").addEventListener("click", function () { elegirAlta("solteros"); });
document.getElementById("equipo-casados").addEventListener("click", function () { elegirAlta("casados"); });

document.getElementById("alta").addEventListener("submit", function (evento) {
  evento.preventDefault();
  if (inscripcionCerrada()) {
    aplicarCierreAlta();
    ponerTexto("error-alta", "La inscripción cerró el domingo a las 2:00 p.m.");
    return;
  }
  var nombre = limpiarNombre(document.getElementById("nombre").value);
  var celular = soloDigitos(document.getElementById("celular").value);
  if (nombre.length < 2) {
    ponerTexto("error-alta", "Escribe el nombre.");
    return;
  }
  if (!/^[0-9]{8,15}$/.test(celular)) {
    ponerTexto("error-alta", "Escribe un celular válido, de 8 a 15 números.");
    return;
  }
  if (equipoAlta !== "solteros" && equipoAlta !== "casados") {
    ponerTexto("error-alta", "Elige Solteros o Casados.");
    return;
  }
  ponerTexto("error-alta", "");
  ponerTexto("ok-alta", "");
  var boton = document.getElementById("boton-alta");
  boton.disabled = true;
  rpc("inscribir_encargado", {
    p_clave: clave,
    p_nombre: nombre,
    p_celular: celular,
    p_equipo: equipoAlta
  }).then(function (datos) {
    estado = leerEstado(datos) || estado;
    pintarEstado();
    document.getElementById("nombre").value = "";
    document.getElementById("celular").value = "";
    ponerTexto("ok-alta", nombre + " quedó en " + (equipoAlta === "solteros" ? "Solteros" : "Casados") + ".");
    return rpc("listar", { p_clave: clave });
  }).then(function (lista) {
    if (lista) {
      gente = ordenarPorInscripcion(Array.isArray(lista) ? lista : []);
      pintarLista();
      pintarCuotaPersona();
    }
  }).catch(function (error) {
    ponerTexto("error-alta", error.message || "No se pudo inscribir.");
  }).then(function () {
    boton.disabled = false;
  });
});

document.getElementById("buscar").addEventListener("input", pintarLista);
document.getElementById("monto").addEventListener("input", pintarCuotaPersona);

function mover(persona, equipo) {
  var destino = equipo === "casados" ? "Casados" : "Solteros";
  var seguro = window.confirm("Si pasas a " + persona.nombre + " a " + destino + ", la cuota de los dos equipos cambia. ¿Lo haces?");
  if (!seguro) return;
  rpc("cambiar_equipo", { p_clave: clave, p_id: persona.id, p_equipo: equipo }).then(function () {
    return refrescar();
  }).catch(function (error) {
    window.alert(error.message || "No se pudo cambiar el equipo.");
  });
}

function marcarPago(persona, pagado) {
  rpc("marcar_pago", { p_clave: clave, p_id: persona.id, p_pagado: pagado }).then(function () {
    return refrescar();
  }).catch(function (error) {
    window.alert(error.message || "No se pudo marcar el pago.");
    pintarLista();
  });
}

function eliminar(persona) {
  var seguro = window.confirm("Si quitas a " + persona.nombre + ", la cuota de su equipo cambia para todos. ¿La quitas?");
  if (!seguro) return;
  rpc("quitar", { p_clave: clave, p_id: persona.id }).then(function () {
    return refrescar();
  }).catch(function (error) {
    window.alert(error.message || "No se pudo quitar.");
  });
}

document.getElementById("clave-nueva").addEventListener("submit", function (evento) {
  evento.preventDefault();
  var nueva = document.getElementById("nueva").value;
  var repetir = document.getElementById("repetir").value;
  if (nueva !== repetir) {
    ponerTexto("error-clave", "Las claves no coinciden.");
    return;
  }
  ponerTexto("error-clave", "");
  ponerTexto("ok-clave", "");
  var boton = document.getElementById("boton-clave");
  boton.disabled = true;
  rpc("cambiar_clave", { p_clave: clave, p_nueva: nueva }).then(function () {
    clave = nueva.replace(/^\s+|\s+$/g, "");
    try { localStorage.setItem(CLAVE_SESION, clave); } catch (e) {}
    document.getElementById("nueva").value = "";
    document.getElementById("repetir").value = "";
    ponerTexto("ok-clave", "Clave cambiada.");
  }).catch(function (error) {
    ponerTexto("error-clave", error.message || "No se pudo cambiar la clave.");
  }).then(function () {
    boton.disabled = false;
  });
});

document.getElementById("salir").addEventListener("click", cerrarPanel);

var guardada = "";
try { guardada = localStorage.getItem(CLAVE_SESION) || ""; } catch (e) { guardada = ""; }
if (guardada) {
  clave = guardada;
  abrirPanel();
  aplicarCierreAlta();
  refrescar().catch(function () { cerrarPanel(); });
}
